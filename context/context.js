import React, { useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
//import { JSBI } from "@uniswap/sdk";
import JSBI from "jsbi";
import web3Modal from "web3modal"

//INTERNAL IMPORT
import { SwapRouter } from "@uniswap/universal-router-sdk";
import { TradeType, Ether, Token, CurrencyAmount, Percent } from "@uniswap/sdk-core";
import { Trade as V2Trade } from "@uniswap/v2-sdk";
import { Pool, nearestUsableTick, TickMath, TICK_SPACINGS, FeeAmount, Trade as V3Tradde, Route as RouteV3, SqrtPriceMath, LiquidityMath } from "@uniswap/v3-sdk";

import { MixedRouteTrade, Trade as RouterTrade } from "@uniswap/router-sdk";
import IUniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";

//Internal Import

import {ERC20_ABI, web3Provider, CONNECTING_CONTRACT} from './constants'
import {shortenAddress, parseErrorMsg} from '../utils/index'

export const CONTEXT = React.createContext();

export const PROVIDER = ({children}) => {
    const TOKEN_SWAP = "TOKEN SWAP DAPP";
    const [loader, setLoader] = useState(false);
    const [address, setaddress] = useState("");
    const [chainId, setchainId] = useState();
    
    //NOTIFICATIONS

    const notifyError = (msg) => toast.error(msg, {duration: 4000});
    const notifySuccess = (msg) => toast.success(msg, {duration: 4000});

    //CONNECT WALLET

    const connect = async() => {
        try {
            if(!window.ethereum) return notifyError('Install Metamask')
            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts"
            });

            if (accounts.length) {
                setAddress(accounts[0])
            } else {
                notifyError("Sorry... No account found")
            }
            const provider = await web3Provider();
            const network = await provider.getNetwork();
            setchainId(network.chainId);
        } catch (error) {
            const errorMsg = parseErrorMsg(error);
            notifyError(errorMsg)
            console.log(error)
        }
    }


//LOAD TOKEN DATA

const LOAD_TOKEN = async(token) => {
    try {
        const tokenDetail = await CONNECTING_CONTRACT(token);
        return tokenDetail;
    } catch (error) {
        const errorMsg = parseErrorMsg(error);
        notifyError(errorMsg)
        console.log(error)
    }
}


//Internal Finction

async function getPool(tokenA, tokenB, FeeAmount, provider) {
    const [token0, token1] = tokenA.sortsBefore(tokenB) 
    ? [tokenA, tokenB]    
    : [tokenB, tokenA];

    const poolAddress = Pool.getAddress(token0, token1, FeeAmount);

    const contract = new  ethers.Contract(poolAddress, IUniswapV3Pool, provider);
    
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

//Swap_Option function internal

function swapOptions(options) {
    return Object.assign(
        {
            slippaageTolerance: new Percent(5, 1000),
            recipient: RECIPIENT,
        },
        options
    )
}

//BUILDTRADE

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

//DEMO ACCOUNT

const RECIPIENT = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

//SWAP FUNCTION
const swap = async(token_1, token_2, swapInputAmount) => {
    try {
        console.log("CALLING ME _____ SWAP");
        const _inputAmount = 1;
        const provider = web3Provider();

        const network = await provider.getNetwork();
        //const ETHER = Ether.onChain(network.chainId)
        const ETHER = Ether.onChain(1);

        //TOKEN CONTRACT

        const tokenAddress1 = await CONNECTING_CONTRACT("")
        const tokenAddress2 = await CONNECTING_CONTRACT("")

        //TOKEN DETAILS
        const TOKEN_A = new Token(
            tokenAddress1.chainId,
            tokenAddress1.address ,
            tokenAddress1.decimals,
            tokenAddress1.symbol,
            tokenAddress1.name 
        );
        const TOKEN_B = new Token(
            tokenAddress2.chainId,
            tokenAddress2.address ,
            tokenAddress2.decimals,
            tokenAddress2.symbol,
            tokenAddress2.name 
        );

        const WETH_USDC_V3 = await getPool(
            TOKEN_A,
            TOKEN_B,
            FeeAmount.MEDIUM,
            provider
        );

        const inputEther = ethers.utils.parseEther("1").toString();

        const trade = await V3Trade.fromRoute(
            new RouteV3([WETH_USDC_V3], ETHER, TOKEN_B),
            CurrencyAmount.fromRawAmount(Ether, inputEther),
            TradeType.EXACT_INPUT
        );

        const RouterTrade = buildTrade([trade]);

        const opts = swapOptions({});

        const params = SwapRouter.swapERC20CallParameters(RouterTrade, opts);

        console.log(WETH_USDC_V3);
        console.log(trade);
        console.log(RouterTrade);
        console.log(opts);
        console.log(params);

        let ethBalance
        let tokenA;
        let tokenB;

        ethBalance = await provider.getBalance(RECIPIENT);
        tokenA = await tokenAddress1.balance;
        tokenB = await tokenAddress2.balance;
        console.log("___BEFORE");
        console.log("EthBalance: ", ethers.utils.formatUnits(ethBalance, 18))
        console.log("tokenA: ", tokenA)
        console.log("tokenB: ", tokenB)

        const tx = await Signer.sendTransaction({
            data: params.calldata,
            to: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
            value: params.value,
            from: RECIPIENT,
        });

        console.log("_____ CALLING ME");
        const receipt = await tx.wait();

        console.log("_____SUCCESS");
        console.log("STATUS", receipt.status);

        ethBalance = await provider.getBalance(RECIPIENT);
        tokenA = await tokenAddress1.balance;
        tokenB = await tokenAddress2.balance;
        console.log("______AFTER");

        console.log("EthBalance: ", ethers.utils.formatUnits(ethBalance, 18))
        console.log("tokenA: ", tokenA)
        console.log("tokenB: ", tokenB)

    } catch (error) {
    const errorMsg = parseErrorMsg(error);
    notifyError(errorMsg);
    console.log(error);
    }
};

return (
    <CONTEXT.Provider value={{TOKEN_SWAP, LOAD_TOKEN, notifyError, notifySuccess, setLoader, loader, connect, address, swap,}}>
        {children}
    </CONTEXT.Provider>
)

}