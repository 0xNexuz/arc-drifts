import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const USDC = 1_000_000n;
const STREAMING = 0;
const DELAYED = 1;
const CANCELABLE = 2;
const RECURRING = 3;

async function deployFixture() {
  const [sender, recipient, other] = await ethers.getSigners();
  const usdc = await ethers.deployContract("MockUSDC");
  const core = await ethers.deployContract("ArcDriftCore", [await usdc.getAddress()]);

  await usdc.mint(sender.address, 1_000n * USDC);
  await usdc.approve(await core.getAddress(), 1_000n * USDC);

  const now = await networkHelpers.time.latest();

  return { core, usdc, sender, recipient, other, now };
}

describe("ArcDriftCore", function () {
  it("streams funds linearly and closes at the end", async function () {
    const { core, usdc, recipient, now } = await deployFixture();
    const amount = 100n * USDC;

    await core.createDrift(recipient.address, amount, now + 10, now + 110, 0, STREAMING);

    await networkHelpers.time.increaseTo(now + 60);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(51n * USDC);

    await networkHelpers.time.increaseTo(now + 111);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(amount);

    const drift = await core.drifts(0);
    expect(drift.active).to.equal(false);
  });

  it("executes delayed transfers only after the deadline", async function () {
    const { core, usdc, recipient, now } = await deployFixture();
    const amount = 25n * USDC;

    await core.createDrift(recipient.address, amount, now + 10, now + 110, 0, DELAYED);
    await networkHelpers.time.increaseTo(now + 80);
    await expect(core.executeDrift(0)).to.be.revertedWith("No new money unlocked");

    await networkHelpers.time.increaseTo(now + 111);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
  });

  it("allows the sender to cancel a cancelable transfer", async function () {
    const { core, usdc, sender, recipient, other, now } = await deployFixture();
    const amount = 40n * USDC;
    const senderBalanceBefore = await usdc.balanceOf(sender.address);

    await core.createDrift(recipient.address, amount, now + 10, now + 110, 0, CANCELABLE);

    await expect(core.connect(other).cancelDrift(0)).to.be.revertedWith("Only sender");
    await expect(core.cancelDrift(0)).to.emit(core, "DriftCanceled").withArgs(0, amount);

    expect(await usdc.balanceOf(sender.address)).to.equal(senderBalanceBefore);
    const drift = await core.drifts(0);
    expect(drift.active).to.equal(false);
  });

  it("unlocks recurring payments in fixed installments", async function () {
    const { core, usdc, recipient, now } = await deployFixture();
    const amount = 120n * USDC;

    await core.createDrift(recipient.address, amount, now + 10, now + 130, 30, RECURRING);

    await networkHelpers.time.increaseTo(now + 39);
    expect(await core.releasable(0)).to.equal(0);

    await networkHelpers.time.increaseTo(now + 41);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(30n * USDC);

    await networkHelpers.time.increaseTo(now + 101);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(90n * USDC);

    await networkHelpers.time.increaseTo(now + 131);
    await core.executeDrift(0);
    expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
  });

  it("validates recurring intervals", async function () {
    const { core, recipient, now } = await deployFixture();

    await expect(core.createDrift(recipient.address, USDC, now + 10, now + 110, 0, RECURRING))
      .to.be.revertedWith("Interval required");

    await expect(core.createDrift(recipient.address, USDC, now + 10, now + 110, 10, STREAMING))
      .to.be.revertedWith("Interval only for recurring");
  });
});
