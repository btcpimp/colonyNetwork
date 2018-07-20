/* globals artifacts */
import { BN } from "bn.js";
import { toBN } from "web3-utils";

import { getTokenArgs, web3GetTransactionReceipt, web3GetCode, checkErrorRevert, forwardTime, getBlockTime } from "../helpers/test-helper";
import { setupColonyVersionResolver } from "../helpers/upgradable-contracts";

const EtherRouter = artifacts.require("EtherRouter");
const Colony = artifacts.require("Colony");
const ColonyFunding = artifacts.require("ColonyFunding");
const ColonyTask = artifacts.require("ColonyTask");
const Resolver = artifacts.require("Resolver");
const IColony = artifacts.require("IColony");
const IColonyNetwork = artifacts.require("IColonyNetwork");
const DutchAuction = artifacts.require("DutchAuction");
const Token = artifacts.require("Token");

contract("ColonyNetworkAuction", accounts => {
  const BIDDER_1 = accounts[1];
  const BIDDER_2 = accounts[2];
  const BIDDER_3 = accounts[3];

  let metaColony;
  let colonyNetwork;
  let tokenAuction;
  let quantity;
  let clnyNeededForMaxPriceAuctionSellout;
  let clny;
  let token;
  let createAuctionTxReceipt;
  let resolverColonyNetworkDeployed;

  before(async () => {
    quantity = new BN(10).pow(new BN(36)).muln(3);
    clnyNeededForMaxPriceAuctionSellout = new BN(10).pow(new BN(54)).muln(3);
    resolverColonyNetworkDeployed = await Resolver.deployed();
  });

  beforeEach(async () => {
    const colonyTemplate = await Colony.new();
    const colonyFunding = await ColonyFunding.new();
    const colonyTask = await ColonyTask.new();
    const resolver = await Resolver.new();
    const etherRouter = await EtherRouter.new();
    await etherRouter.setResolver(resolverColonyNetworkDeployed.address);
    colonyNetwork = await IColonyNetwork.at(etherRouter.address);
    await setupColonyVersionResolver(colonyTemplate, colonyTask, colonyFunding, resolver, colonyNetwork);

    clny = await Token.new("Colony Network Token", "CLNY", 18);
    await colonyNetwork.createMetaColony(clny.address);
    const metaColonyAddress = await colonyNetwork.getMetaColony.call();
    metaColony = await IColony.at(metaColonyAddress);
    await clny.setOwner(metaColony.address);
    await metaColony.setTokenSupplyCeiling(
      toBN(2)
        .pow(toBN(256))
        .subn(1)
        .toString()
    );

    await colonyNetwork.startNextCycle();

    const args = getTokenArgs();
    token = await Token.new(...args);
    await token.mint(quantity.toString());
    await token.transfer(colonyNetwork.address, quantity.toString());
    const { logs, receipt } = await colonyNetwork.startTokenAuction(token.address);
    createAuctionTxReceipt = receipt;
    const auctionAddress = logs[0].args.auction;
    tokenAuction = DutchAuction.at(auctionAddress);
  });

  describe("when initialising an auction", async () => {
    it("should initialise auction with correct given parameters", async () => {
      const clnyAddress = await tokenAuction.clnyToken.call();
      assert.equal(clnyAddress, clny.address);
      const tokenAddress = await tokenAuction.token.call();
      assert.equal(tokenAddress, token.address);
    });

    it("should fail with 0x0 token", async () => {
      await checkErrorRevert(colonyNetwork.startTokenAuction("0x0"));
    });

    it("should fail if auction is initialised for the CLNY token", async () => {
      await checkErrorRevert(colonyNetwork.startTokenAuction(clny.address));
    });

    it("should fail with zero quantity", async () => {
      const args = getTokenArgs();
      const otherToken = await Token.new(...args);
      await checkErrorRevert(colonyNetwork.startTokenAuction(otherToken.address));
    });
  });

  describe("when starting an auction", async () => {
    it("should set the `quantity` correctly and minPrice to 1", async () => {
      const quantityNow = await tokenAuction.quantity.call();
      assert.equal(quantityNow.toString(10), quantity.toString());

      const minPrice = await tokenAuction.minPrice.call();
      assert.equal(minPrice.toString(10), 1);
    });

    it("should set the minimum price correctly for quantity < 1e18", async () => {
      const args = getTokenArgs();
      const otherToken = await Token.new(...args);
      await otherToken.mint(1e17);
      await otherToken.transfer(colonyNetwork.address, 1e17);
      const { logs } = await colonyNetwork.startTokenAuction(otherToken.address);
      const auctionAddress = logs[0].args.auction;
      tokenAuction = DutchAuction.at(auctionAddress);
      const minPrice = await tokenAuction.minPrice.call();
      assert.equal(minPrice.toString(10), 10);
    });

    it("should set the `startTime` correctly", async () => {
      const createAuctionTxBlockNumber = createAuctionTxReceipt.blockNumber;
      const blockTime = await getBlockTime(createAuctionTxBlockNumber);

      const startTime = await tokenAuction.startTime();
      assert.equal(startTime.toNumber(), blockTime);
    });

    it("should set the `started` property correctly", async () => {
      const started = await tokenAuction.started.call();
      assert.isTrue(started);
    });

    it("should fail starting the auction twice", async () => {
      await checkErrorRevert(colonyNetwork.startTokenAuction(token.address));
    });

    it("should fail if the last auction for the same token started less than 30 days", async () => {
      await token.mint(quantity.toString());
      await token.transfer(colonyNetwork.address, quantity.toString());
      await checkErrorRevert(colonyNetwork.startTokenAuction(token.address));
    });

    const auctionProps = [
      {
        duration: 1000,
        price: new BN("989583333333333333333333333333333333")
      },
      {
        duration: 72000,
        price: new BN("250000000000000000000000000000000000")
      },
      {
        duration: 86400,
        price: new BN(10).pow(new BN(35))
      },
      {
        duration: 144000,
        price: new BN("40000000000000000000000000000000000")
      },
      {
        duration: 172800,
        price: new BN(10).pow(new BN(34))
      },
      {
        duration: 259200,
        price: new BN(10).pow(new BN(33))
      },
      {
        duration: 345600,
        price: new BN(10).pow(new BN(32))
      },
      {
        duration: 432000,
        price: new BN(10).pow(new BN(31))
      },
      {
        duration: 518400,
        price: new BN(10).pow(new BN(30))
      },
      {
        duration: 1382400,
        price: new BN(10).pow(new BN(20))
      },
      {
        duration: 2937600,
        price: new BN(100)
      },
      {
        duration: 3110400,
        price: new BN(1)
      },
      {
        duration: 3193200, // Crosses the boundary where price of 1 is always returned (for quantity > 1e18)
        price: new BN(1)
      }
    ];

    auctionProps.forEach(async auctionProp => {
      it(`should correctly calculate price and remaining CLNY amount to end auction at duration ${auctionProp.duration}`, async () => {
        await forwardTime(auctionProp.duration, this);
        const currentPrice = await tokenAuction.price.call();
        // Expect up to 1% error margin because of forwarding block time inaccuracies
        const errorMarginPrice = auctionProp.price.divn(100);
        const currentPriceString = currentPrice.toString(10);
        // Chai assert.closeTo does not work with Big Numbers so some manual comaring to error margin is required
        const differencePrices = auctionProp.price.sub(new BN(currentPriceString));
        assert.isTrue(differencePrices.lte(errorMarginPrice));

        const totalToEndAuction = await tokenAuction.totalToEndAuction.call();
        const amount = new BN(currentPriceString).mul(quantity).div(new BN(10).pow(new BN(18)));
        const errorMarginQuantity = amount.divn(100);
        const differenceQuantity = totalToEndAuction.sub(amount);
        assert.isTrue(differenceQuantity.lte(errorMarginQuantity));
      });
    });

    it("should succeed if the last auction for the same token was started at least 30 days ago", async () => {
      const previousAuctionStartTime = await tokenAuction.startTime();
      // 30 days (in seconds)
      await forwardTime(30 * 24 * 60 * 60, this);

      await token.mint(quantity.toString());
      await token.transfer(colonyNetwork.address, quantity.toString());
      await colonyNetwork.startTokenAuction(token.address);
      const newAuctionStartTime = await tokenAuction.startTime();
      assert.notEqual(previousAuctionStartTime, newAuctionStartTime);
    });
  });

  describe("when bidding", async () => {
    it("can bid", async () => {
      await metaColony.mintInitialTokens("1000000000000000000");
      await metaColony.bootstrapColony([BIDDER_1], ["1000000000000000000"]);
      await clny.approve(tokenAuction.address, "1000000000000000000", { from: BIDDER_1 });
      await tokenAuction.bid("1000000000000000000", { from: BIDDER_1 });
      const bid = await tokenAuction.bids.call(BIDDER_1);
      assert.equal(bid, "1000000000000000000");
      const bidCount = await tokenAuction.bidCount.call();
      assert.equal(bidCount.toNumber(), 1);
    });

    it("bid tokens are locked", async () => {
      await metaColony.mintInitialTokens("1000000000000000000");
      await metaColony.bootstrapColony([BIDDER_1], ["1000000000000000000"]);
      await clny.approve(tokenAuction.address, "1000000000000000000", { from: BIDDER_1 });
      await tokenAuction.bid("1000000000000000000", { from: BIDDER_1 });
      const lockedTokens = await clny.balanceOf.call(tokenAuction.address);
      assert.equal(lockedTokens.toString(), "1000000000000000000");
    });

    it("can bid more than once", async () => {
      await metaColony.mintInitialTokens("2000000000000000000");
      await metaColony.bootstrapColony([BIDDER_1], ["2000000000000000000"]);
      await clny.approve(tokenAuction.address, "2000000000000000000", { from: BIDDER_1 });
      await tokenAuction.bid("1100000000000000000", { from: BIDDER_1 });
      await tokenAuction.bid("900000000000000000", { from: BIDDER_1 });
      const bidCount = await tokenAuction.bidCount.call();
      assert.equal(bidCount.toNumber(), 1);
    });

    it("once target reached, endTime is set correctly", async () => {
      const amount = clnyNeededForMaxPriceAuctionSellout.divn(3).toString();
      await metaColony.mintInitialTokens(clnyNeededForMaxPriceAuctionSellout.toString());
      await metaColony.bootstrapColony([BIDDER_1, BIDDER_2, BIDDER_3], [amount, amount, amount]);
      await clny.approve(tokenAuction.address, amount, { from: BIDDER_1 });
      await clny.approve(tokenAuction.address, amount, { from: BIDDER_2 });
      await clny.approve(tokenAuction.address, amount, { from: BIDDER_3 });
      await tokenAuction.bid(amount, { from: BIDDER_1 });
      await tokenAuction.bid(amount, { from: BIDDER_2 });

      const { tx } = await tokenAuction.bid(amount, { from: BIDDER_3 });
      const receipt = await web3GetTransactionReceipt(tx);
      const bidReceiptBlock = receipt.blockNumber;
      const blockTime = await getBlockTime(bidReceiptBlock);
      const endTime = await tokenAuction.endTime.call();
      assert.equal(endTime.toString(), blockTime);

      const bidCount = await tokenAuction.bidCount.call();
      assert.equal(bidCount.toNumber(), 3);
    });

    it("if bid overshoots the target quantity, it is only partially accepted", async () => {
      const amount = clnyNeededForMaxPriceAuctionSellout.addn(20).toString();
      await metaColony.mintInitialTokens(amount);
      await metaColony.bootstrapColony([BIDDER_1], [amount]);
      await clny.approve(tokenAuction.address, amount, { from: BIDDER_1 });
      const totalToEndAuction = await tokenAuction.totalToEndAuction.call();
      await tokenAuction.bid(amount, { from: BIDDER_1 });
      const receivedTotal = await tokenAuction.receivedTotal.call();
      const bid = await tokenAuction.bids.call(BIDDER_1);
      assert(bid.lte(totalToEndAuction));
      assert(receivedTotal.lte(totalToEndAuction));
      assert.equal(receivedTotal.toString(), bid.toString());
    });

    it("after target is sold, bid is rejected", async () => {
      await metaColony.mintInitialTokens(clnyNeededForMaxPriceAuctionSellout.addn(1).toString());
      await metaColony.bootstrapColony([BIDDER_1], [clnyNeededForMaxPriceAuctionSellout.addn(1).toString()]);
      await clny.approve(tokenAuction.address, clnyNeededForMaxPriceAuctionSellout.addn(1).toString(), { from: BIDDER_1 });
      await tokenAuction.bid(clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
      await checkErrorRevert(tokenAuction.bid(1, { from: BIDDER_1 }));
    });

    it("cannot finalize when target not reached", async () => {
      await metaColony.mintInitialTokens("3000");
      await metaColony.bootstrapColony([BIDDER_1], ["3000"]);
      await clny.approve(tokenAuction.address, "3000", { from: BIDDER_1 });
      await tokenAuction.bid("3000", { from: BIDDER_1 });
      await checkErrorRevert(tokenAuction.finalize());
    });

    it("cannot bid with 0 tokens", async () => {
      await checkErrorRevert(tokenAuction.bid(0));
    });
  });

  describe("when finalizing auction", async () => {
    beforeEach(async () => {
      await metaColony.mintInitialTokens(clnyNeededForMaxPriceAuctionSellout.toString());
      await metaColony.bootstrapColony([BIDDER_1], [clnyNeededForMaxPriceAuctionSellout.toString()]);
      await clny.approve(tokenAuction.address, clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
      await tokenAuction.bid(clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
    });

    it("sets correct final token price", async () => {
      await tokenAuction.finalize();
      const receivedTotal = await tokenAuction.receivedTotal.call();
      const endPrice = new BN(10)
        .pow(new BN(18))
        .mul(new BN(receivedTotal.toString(10)))
        .div(quantity)
        .addn(1);
      const finalPrice = await tokenAuction.finalPrice.call();
      assert.equal(endPrice.toString(), finalPrice.toString(10));
    });

    it("sets the finalized property", async () => {
      await tokenAuction.finalize();
      const finalized = await tokenAuction.finalized.call();
      assert.isTrue(finalized);
    });

    it("Colony network gets all CLNY sent to the auction in bids", async () => {
      const balanceBefore = await clny.balanceOf.call(colonyNetwork.address);
      await tokenAuction.finalize();
      const receivedTotal = await tokenAuction.receivedTotal.call();
      assert.notEqual(receivedTotal.toNumber(), 0);
      const balanceAfter = await clny.balanceOf.call(colonyNetwork.address);
      assert.equal(balanceBefore.add(receivedTotal).toString(), balanceAfter.toString());
    });

    it("cannot bid after finalized", async () => {
      await tokenAuction.finalize();
      await metaColony.mintInitialTokens(1000);
      await metaColony.bootstrapColony([BIDDER_1], [1000]);
      await clny.approve(tokenAuction.address, 1000, { from: BIDDER_1 });
      await checkErrorRevert(tokenAuction.bid(1000, { from: BIDDER_1 }));
    });

    it("cannot finalize after finalized once", async () => {
      await tokenAuction.finalize();
      await checkErrorRevert(tokenAuction.finalize());
    });

    it("cannot claim if not finalized", async () => {
      await checkErrorRevert(tokenAuction.claim({ from: BIDDER_1 }));
    });
  });

  describe("when claiming tokens", async () => {
    it("should transfer to bidder correct number of tokens at finalPrice", async () => {
      const bidAmount1 = new BN(10).pow(new BN(36));
      const bidAmount2 = new BN(10).pow(new BN(38));
      const bidAmount3 = new BN(10).pow(new BN(36)).muln(199);

      await metaColony.mintInitialTokens(
        bidAmount1
          .add(bidAmount2)
          .add(bidAmount3)
          .toString()
      );
      await metaColony.bootstrapColony([BIDDER_1, BIDDER_2, BIDDER_3], [bidAmount1.toString(), bidAmount2.toString(), bidAmount3.toString()]);
      await clny.approve(tokenAuction.address, bidAmount1.toString(), { from: BIDDER_1 });
      await clny.approve(tokenAuction.address, bidAmount2.toString(), { from: BIDDER_2 });
      await clny.approve(tokenAuction.address, bidAmount3.toString(), { from: BIDDER_3 });

      await tokenAuction.bid(bidAmount1.toString(), { from: BIDDER_1 }); // Bids at near max price of 1e36 CLNY per 1e18 Tokens
      await forwardTime(1382400, this); // Gets us near price of 1e20 CLNY per 1e18 Tokens
      await tokenAuction.bid(bidAmount2.toString(), { from: BIDDER_2 });
      await tokenAuction.bid(bidAmount3.toString(), { from: BIDDER_3 });

      await tokenAuction.finalize();
      const finalPrice = await tokenAuction.finalPrice.call();
      const finalPriceString = finalPrice.toString();

      let claimCount;
      let tokenBidderBalance;
      let tokensToClaim;

      await tokenAuction.claim({ from: BIDDER_1 });
      claimCount = await tokenAuction.claimCount.call();
      assert.equal(claimCount.toNumber(), 1);

      tokenBidderBalance = await token.balanceOf.call(BIDDER_1);
      tokensToClaim = new BN(10)
        .pow(new BN(18))
        .mul(bidAmount1)
        .div(new BN(finalPriceString));
      assert.equal(tokenBidderBalance.toString(10), tokensToClaim.toString());

      await tokenAuction.claim({ from: BIDDER_2 });
      claimCount = await tokenAuction.claimCount.call();
      assert.equal(claimCount.toNumber(), 2);
      tokenBidderBalance = await token.balanceOf.call(BIDDER_2);
      tokensToClaim = new BN(10)
        .pow(new BN(18))
        .mul(bidAmount2)
        .div(new BN(finalPriceString));
      assert.equal(tokenBidderBalance.toString(10), tokensToClaim.toString());

      const bid3 = await tokenAuction.bids.call(BIDDER_3);
      await tokenAuction.claim({ from: BIDDER_3 });
      claimCount = await tokenAuction.claimCount.call();
      assert.equal(claimCount.toNumber(), 3);
      tokenBidderBalance = await token.balanceOf.call(BIDDER_3);
      const bid3BN = new BN(bid3.toString(10));
      tokensToClaim = new BN(10)
        .pow(new BN(18))
        .mul(bid3BN)
        .div(new BN(finalPriceString));
      assert.equal(tokenBidderBalance.toString(10), tokensToClaim.toString());
    });

    it("should set the bid amount to 0", async () => {
      await metaColony.mintInitialTokens(clnyNeededForMaxPriceAuctionSellout.toString());
      await metaColony.bootstrapColony([BIDDER_1], [clnyNeededForMaxPriceAuctionSellout.toString()]);
      await clny.approve(tokenAuction.address, clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
      await tokenAuction.bid(clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
      await tokenAuction.finalize();
      await tokenAuction.claim({ from: BIDDER_1 });
      const bid = await tokenAuction.bids.call(BIDDER_1);
      assert.equal(bid.toNumber(), 0);
    });
  });

  describe("when closing the auction", async () => {
    beforeEach(async () => {
      await metaColony.mintInitialTokens(clnyNeededForMaxPriceAuctionSellout.toString());
      await metaColony.bootstrapColony([BIDDER_1], [clnyNeededForMaxPriceAuctionSellout.toString()]);
      await clny.approve(tokenAuction.address, clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
      await tokenAuction.bid(clnyNeededForMaxPriceAuctionSellout.toString(), { from: BIDDER_1 });
    });

    it("should be able to close the auction and kill the auction contract", async () => {
      await tokenAuction.finalize();
      await tokenAuction.claim({ from: BIDDER_1 });
      await tokenAuction.close();
      const code = await web3GetCode(tokenAuction.address);
      assert.equal(code, 0);
    });

    it("should fail if auction not finalized", async () => {
      await checkErrorRevert(tokenAuction.close());
    });

    it("should fail if not all bids have been claimed", async () => {
      await tokenAuction.finalize();
      await checkErrorRevert(tokenAuction.close());
    });

    it("should fail if there are CLNY tokens left owned by the auction", async () => {
      await tokenAuction.finalize();
      await tokenAuction.claim({ from: BIDDER_1 });
      await metaColony.mintInitialTokens(100);
      await metaColony.bootstrapColony([BIDDER_1], [100]);
      await clny.transfer(tokenAuction.address, 100, { from: BIDDER_1 });
      await checkErrorRevert(tokenAuction.close());
    });
  });
});
