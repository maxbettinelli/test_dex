// import React, { useState } from "react";
// import { ethers } from "ethers";
// import toast from "react-hot-toast";
// import { JSBI } from "@uniswap/sdk";
// //import JSBI from "jsbi";
// import web3Modal from "web3modal"

//INTERNAL IMPORT
const { ethers } = require("hardhat");
const { SwapRouter } = require("@uniswap/universal-router-sdk");
const { TradeType, Ether, Token, CurrencyAmount, Percent } = require("@uniswap/sdk-core");
const { Trade: V2Trade } = require("@uniswap/v2-sdk");
const { Pool, nearestUsableTick, TickMath, TICK_SPACINGS, FeeAmount, Trade: V3Trade, Route: RouteV3, SqrtPriceMath, LiquidityMath } = require("@uniswap/v3-sdk");

const { MixedRouteTrade, Trade: RouterTrade } = require("@uniswap/router-sdk");
const IUniswapV3Pool =  require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const JSBI = require("jsbi");
const erc20Abi = require("../abis__erc20.json");

const hardhat = require("hardhat");
const provider = hardhat.ethers.provider;
//
const ETHER = Ether.onChain(1);
const WETH = new Token(
    1,
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    18,
    "WETH",
    "Wrapped Ether"
);
const USDC = new Token(
    1,
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    6,
    "USDC",
    "USD Coin"
);

const wethContract = new hardhat.ethers.Contract(
    WETH.address,
    erc20Abi,
    provider
);
const usdcContract = new hardhat.ethers.Contract(
    USDC.address,
    erc20Abi,
    provider
)

//copied getPool function
async function getPool(tokenA, tokenB, FeeAmount, provider) {
    const [token0, token1] = tokenA.sortsBefore(tokenB) 
    ? [tokenA, tokenB]    
    : [tokenB, tokenA];

    const poolAddress = Pool.getAddress(token0, token1, FeeAmount);

    const contract = new hardhat.ethers.Contract(poolAddress, IUniswapV3Pool, provider); //added .abi
    
    let liquidity = await contract.liquidity();

    let {sqrtPriceX96, tick} = await contract.slot0();

    liquidity = JSBI.BigInt(liquidity.toString());
    sqrtPriceX96 = JSBI.BigInt(sqrtPriceX96.toString());

    console.log("CALLING POOL ____")
    return new Pool(token0, token1, FeeAmount, sqrtPriceX96, liquidity, tick, [{
        index: nearestUsableTick(TickMath.MIN_TICK. TICK_SPACINGS[FeeAmount]),
        liquidityNet: liquidity,
        liquidityGross: liquidity,        
    },
    {
        index: nearestUsableTick(TickMath.MIN_TICK. TICK_SPACINGS[FeeAmount]),
        liquidityNet: JSBI.multiply(liquidity, JSBI.BigInt("-1")),
        liquidityGross: liquidity,        
    },
    ]);

}

//swapOptions function

function swapOptions(options) {
    return Object.assign(
        {
            slippaageTolerance: new Percent(5, 1000),
            recipient: RECIPIENT,
        },
        options
    )
}
//buildtrade function
function buildTrade(trades){
    return new RouterTrade({
        v2Routes:trades
        .filter((trade) => trade instanceof V2Trade)
        .map((trade) => ({
            routev2: trade.route,
            inputAmount: trade.inputAmount,
            outputAmount: trade.outputAmount,
        })),
        v3Routes:trades
        .filter((trade) => trade instanceof V3Trade)
        .map((trade) => ({
            routev3: trade.route,
            inputAmount: trade.inputAmount,
            outputAmount: trade.outputAmount,
        })),
        mixedRoutes: trades
        .filter((trade) => trade instanceof V3Trade)
        .map((trade) => ({
            mixedRoute: trade.route,
            inputAmount: trade.inputAmount,
            outputAmount: trade.outputAmount,
        })),
        tradeType: trades[0].tradeType,
    });
}

const RECIPIENT = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

async function main() {
    const signer = await hardhat.ethers.getImpersonatedSigner(RECIPIENT);

    const WETH_USDC_V3 = await getPool(WETH, USDC, FeeAmount.MEDIUM);

    const inputEther = hardhat.ethers.utils.parseEther("1").toString();

    const trade = await V3Trade.fromRoute(
        new RouteV3([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
    );

    const RouterTrade = buildTrade([trade]);

    const opts = swapOptions({});

    const params = SwapRouter.swapERC20CallParameters(RouterTrade, opts);

    let ethBalance
    let wethBalance;
    let usdcBalance;

    ethBalance = await provider.getBalance(RECIPIENT);
    wethBalance = await wethContract.balanceOf(RECIPIENT);
    usdcBalance = await usdcContract.balanceOf(RECIPIENT);
    console.log("___BEFORE");
    console.log("EthBalance: ", hardhat.ethers.utils.formatUnits(ethBalance, 18))
    console.log("wethBalance: ", hardhat.ethers.utils.formatUnits(wethBalance, 18))
    console.log("usdcBalance: ", hardhat.ethers.utils.formatUnits(usdcBalance, 6))

    const tx = await Signer.sendTransaction({
        data: params.calldata,
        to: "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B",
        value: params.value,
        from: RECIPIENT,
    });

const receipt = await tx.wait();

        console.log("_____SUCCESS");
        console.log("STATUS", receipt.status);

        console.log(WETH_USDC_V3);
        console.log(trade);
        console.log(RouterTrade);
        console.log(opts);
        console.log(params);

        ethBalance = await provider.getBalance(RECIPIENT);
        wethBalance = await wethContract.balanceOf(RECIPIENT); 
        usdcBalance = await usdcContract.balanceOf(RECIPIENT); 
        console.log("__________ AFTER");

        console.log("EthBalance: ", hardhat.ethers.utils.formatUnits(ethBalance, 18));
        console.log("wethBalance: ", hardhat.ethers.utils.formatUnits(wethBalance, 18));
        console.log("usdcBalance: ", hardhat.ethers.utils.formatUnits(usdcBalance, 6));


}
//END OF VID


main()

.then(() => process.exit(0))

.catch((error) => {
    console.error(error);
    process.exit(1);
});














//Copied from elsewhere


//Internal Import

// const {shortenAddress, parseErrorMsg} = require('../utils/index');

// export const CONTEXT = React.createContext();

// export const PROVIDER = ({children}) => {
//     const TOKEN_SWAP = "TOKEN SWAP DAPP";
//     const [loader, setLoader] = useState(false);
//     const [address, setaddress] = useState("");
//     const [chainId, setchainId] = useState();
    
//     //NOTIFICATIONS

//     const notifyError = (msg) => toast.error(msg, {duration: 4000});
//     const notifySuccess = (msg) => toast.success(msg, {duration: 4000});

//     //CONNECT WALLET

//     const connect = async() => {
//         try {
//             if(!window.ethereum) return notifyError('Install Metamask')
//             const accounts = await window.ethereum.request({
//                 method: "eth_requestAccounts"
//             });

//             if (accounts.length) {
//                 setAddress(accounts[0])
//             } else {
//                 notifyError("Sorry... No account found")
//             }
//             const provider = await web3Provider();
//             const network = await provider.getNetwork();
//             setchainId(network.chainId);
//         } catch (error) {
//             const errorMsg = parseErrorMsg(error);
//             notifyError(errorMsg)
//             console.log(error)
//         }
//     }


// //LOAD TOKEN DATA

// const LOAD_TOKEN = async(token) => {
//     try {
//         const tokenDetail = await CONNECTING_CONTRACT(token);
//         return tokenDetail;
//     } catch (error) {
//         const errorMsg = parseErrorMsg(error);
//         notifyError(errorMsg)
//         console.log(error)
//     }
// }


// //Internal Finction

// async function getPool(tokenA, tokenB, FeeAmount, provider) {
//     const [token0, token1] = tokenA.sortsBefore(tokenB) 
//     ? [tokenA, tokenB]    
//     : [tokenB, tokenA];

//     const poolAddress = Pool.getAddress(token0, token1, FeeAmount);

//     const contract = new  ethers.Contract(poolAddress, IUniswapV3Pool, provider);
    
//     let liquidity = await contract.liquidity();

//     let {sqrtPriceX96, tick} = await contract.slot0();

//     liquidity = JSBI.BigInt(liquidity.toString());
//     sqrtPriceX96 = JSBI.BigInt(sqrtPriceX96.toString());

//     console.log("CALLING POOL ____")
//     return new Pool(token0, token1, FeeAmount, sqrtPriceX96, liquidity, tick, [{
//         index: nearestUsableTick(TickMath.MIN_TICK. TICK_SPACINGS[FeeAmount]),
//         liquidityNet: liquidity,
//         liquidityGross: liquidity,        
//     },
//     {
//         index: nearestUsableTick(TickMath.MIN_TICK. TICK_SPACINGS[FeeAmount]),
//         liquidityNet: JSBI.multiply(liquidity, JSBI.BigInt("-1")),
//         liquidityGross: liquidity,        
//     },
//     ]);

// }

// //Swap_Option function internal

// function swapOptions(options) {
//     return Object.assign(
//         {
//             slippaageTolerance: new Percent(5, 1000),
//             recipient: RECIPIENT,
//         },
//         options
//     )
// }

// //BUILDTRADE

// function buildTrade(trade){
//     return new RouterTrade({
//         v2Routes:trades
//         .filter((trade) => trade instanceof V2Trade)
//         .map((trade) => ({
//             routev2: trade.route,
//             inputAmount: trade.inputAmount,
//             outputAmount: trade.outputAmount,
//         })),
//         v3Routes:trades
//         .filter((trade) => trade instanceof V3Trade)
//         .map((trade) => ({
//             routev3: trade.route,
//             inputAmount: trade.inputAmount,
//             outputAmount: trade.outputAmount,
//         })),
//         mixedRoutes: trades
//         .filter((trade) => trade instanceof V3Trade)
//         .map((trade) => ({
//             mixedRoute: trade.route,
//             inputAmount: trade.inputAmount,
//             outputAmount: trade.outputAmount,
//         })),
//         tradeType: trades[0].tradeType,
//     });
// }

// //DEMO ACCOUNT

// const RECIPIENT = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

// //SWAP FUNCTION
// const swap = async(token_1, token_2, swapInputAmount) => {
//     try {
//         console.log("CALLING ME _____ SWAP");
//         const _inputAmount = 1;
//         const provider = web3Provider();

//         const network = await provider.getNetwork();
//         //const ETHER = Ether.onChain(network.chainId)
//         const ETHER = Ether.onChain(1);

//         //TOKEN CONTRACT

//         const tokenAddress1 = await CONNECTING_CONTRACT("")
//         const tokenAddress2 = await CONNECTING_CONTRACT("")

//         //TOKEN DETAILS
//         const TOKEN_A = new Token(
//             tokenAddress1.chainId,
//             tokenAddress1.address ,
//             tokenAddress1.decimals,
//             tokenAddress1.symbol,
//             tokenAddress1.name 
//         );
//         const TOKEN_B = new Token(
//             tokenAddress2.chainId,
//             tokenAddress2.address ,
//             tokenAddress2.decimals,
//             tokenAddress2.symbol,
//             tokenAddress2.name 
//         );

//         const WETH_USDC_V3 = await getPool(
//             TOKEN_A,
//             TOKEN_B,
//             FeeAmount.MEDIUM,
//             provider
//         );

//         const inputEther = ethers.utils.parseEther("1").toString();

//         const trade = await V3Trade.fromRoute(
//             new RouteV3([WETH_USDC_V3], ETHER, TOKEN_B),
//             CurrencyAmount.fromRawAmount(Ether, inputEther),
//             TradeType.EXACT_INPUT
//         );

//         const RouterTrade = buildTrade([trade]);

//         const opts = swapOptions({});

//         const params = SwapRouter.swapERC20CallParameters(RouterTrade, opts);

//         console.log(WETH_USDC_V3);
//         console.log(trade);
//         console.log(RouterTrade);
//         console.log(opts);
//         console.log(params);

//         let ethBalance
//         let tokenA;
//         let tokenB;

//         ethBalance = await provider.getBalance(RECIPIENT);
//         tokenA = await tokenAddress1.balance;
//         tokenB = await tokenAddress2.balance;
//         console.log("___BEFORE");
//         console.log("EthBalance: ", ethers.utils.formatUnits(ethBalance, 18))
//         console.log("tokenA: ", tokenA)
//         console.log("tokenB: ", tokenB)

//         const tx = await Signer.sendTransaction({
//             data: params.calldata,
//             to: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
//             value: params.value,
//             from: RECIPIENT,
//         });

//         console.log("_____ CALLING ME");
//         const receipt = await tx.wait();

//         console.log("_____SUCCESS");
//         console.log("STATUS", receipt.status);

//         ethBalance = await provider.getBalance(RECIPIENT);
//         tokenA = await tokenAddress1.balance;
//         tokenB = await tokenAddress2.balance;
//         console.log("______AFTER");

//         console.log("EthBalance: ", ethers.utils.formatUnits(ethBalance, 18))
//         console.log("tokenA: ", tokenA)
//         console.log("tokenB: ", tokenB)

//     } catch (error) {
//     const errorMsg = parseErrorMsg(error);
//     notifyError(errorMsg);
//     console.log(error);
//     }
// };

// return (
//     <CONTEXT.Provider value={{TOKEN_SWAP, LOAD_TOKEN, notifyError, notifySuccess, setLoader, loader, connect, address, swap,}}>
//         {children}
//     </CONTEXT.Provider>
// )

// }