import {setGlobalState, getGlobalState } from './state'
import {generateKeysFromEmailPassword, getAddressSensibleFtList, getAddressMvcBalanceByUtxo, signAnyTx, getAddressMvcBalance} from '../lib'
import {Account, BalanceMvc, Key, SensibleFt} from './stateType'
import * as createPostMsg from 'post-msg';
import { mvc } from 'mvc-scrypt';

// local account storage
const accountStorageKey = 'empty'
// localStorage.removeItem(accountStorageKey)
function saveAccountStorage(account: Account | null) {
    //const str = account ? JSON.stringify(account) : ''
    //localStorage.setItem(accountStorageKey, str)
    // do not save account !!!
}
function getAccountStorage(): Account | null {
    const str = localStorage.getItem(accountStorageKey)
    if (!str) {
        return null
    }
    return JSON.parse(str)
}

function isSupportToken(codehash: string) {
    //return SensibleFT.isSupportedToken(codehash)
    return true
}

// app action
let pollingMvcTimer = 0
let pollingSensibleFtTimer = 0
export async function pollingMvcBalance(){
    clearInterval(pollingMvcTimer)
    const fn = async () => {
        const account = getGlobalState('account')
        const key = getGlobalState('key')
        if (!account || !key) {
            return
        }
        try {
            const balance = await getAddressMvcBalance(account.network, key.address)
            setGlobalState('mvcBalance', {balance})
        } catch (err) {
            console.log('getAddressMvcBalance err', account.network, key.address, err)
        }
    }
    await fn()
    pollingMvcTimer = window.setInterval(fn, 5000)
}
export async function pollingSensibleFtBalance() {
    clearInterval(pollingSensibleFtTimer)
    const fn = async () => {
        const account = getGlobalState('account')
        const key = getGlobalState('key')
        if (!account || !key) {
            return
        }
        try {
            const sensibleFtList = await getAddressSensibleFtList(account.network, key.address)
            const valid_sensibleFtList = sensibleFtList.filter(item => isSupportToken(item.codehash));
            setGlobalState('sensibleFtList', valid_sensibleFtList);
        } catch (err) {
            console.log('getAddressSensibleFtList err', account.network, key.address, err)
        }
    }
    await fn()
    pollingSensibleFtTimer = window.setInterval(fn, 5000)
}

export async function saveAccount(account: Account | null) {
    saveAccountStorage(account)
    if (account) {
        const key = generateKeysFromEmailPassword(account.email, account.password, account.network)
        setGlobalState('account', account)
        setGlobalState('key', key)
        await pollingSensibleFtBalance()
        pollingMvcBalance()
    } else {
        setGlobalState("account", null)
        setGlobalState('key', null)
    }
}

export function recoverAccountFromStorage() {
    const account = getAccountStorage()
    saveAccount(account)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// iframe action
export async function runIframeTask() {
    if (window === window.top) {
        return
    }
    const hashdata = JSON.parse(decodeURIComponent(window.location.hash.substr(1)))
    const postMsg = createPostMsg(window.top, '*')
    const id = hashdata.id

    let preAccount: Account | null = null
    let preMvcBalance: BalanceMvc | null = null
    let preSensibleFtBalance: SensibleFt[] = []
    let accountKey: Key | null = null
    // let lastMvcBalance: 

    postMsg.emit(id, {
        type: 'ready'
    })

    const isMvcBalanceEqual = (b1: BalanceMvc | null, b2: BalanceMvc | null) => {
        if (!b1 && !b2) {
            return true
        }
        return b1?.balance === b2?.balance
    }
    const isSensibleFtBalanceEqual = (b1: SensibleFt[], b2: SensibleFt[]) => {
        if (b1.length !== b2.length) {
            return false
        }
        b1.sort((item1, item2) => item1.genesis.localeCompare(item2.genesis))
        b2.sort((item1, item2) => item1.genesis.localeCompare(item2.genesis))

        for (let i = 0; i < b1.length; i++) {
            const item1 = b1[i]
            const item2 = b2[i]
            if (item1.genesis !== item2.genesis) {
                return false
            }
            if (item1.balance !== item2.balance) {
                return false
            }
        }                
        return true
    }
    const isAccountEqual = (b1: Account | null, b2: Account | null) => {
        return (
            b1?.email === b2?.email &&
            b1?.network === b2?.network &&
            b1?.password === b2?.password
        )
    }
    const requestLatestData = async () => {
        const latestAccount = getAccountStorage()
        if (!(isAccountEqual(latestAccount, preAccount))) {
            postMsg.emit(id, {
                type: 'account',
                data: latestAccount
            })
        }
        preAccount = latestAccount;
        if (preAccount) {
            // get balance
            accountKey = generateKeysFromEmailPassword(preAccount.email, preAccount.password, preAccount.network)
            try {
                const latestBalance = await getAddressMvcBalanceByUtxo(preAccount.network, accountKey.address)
                const equal = isMvcBalanceEqual(preMvcBalance, {balance: latestBalance})
                preMvcBalance = {balance: latestBalance}
                if (!equal) {
                    postMsg.emit(id, {
                        type: 'mvcBalance', 
                        data: preMvcBalance,
                    })
                }
            } catch (err) {}
            try {
                const latestBalance = await getAddressSensibleFtList(preAccount.network, accountKey.address)
                const equal = isSensibleFtBalanceEqual(preSensibleFtBalance, latestBalance)
                preSensibleFtBalance = latestBalance
                if (!equal) {
                    postMsg.emit(id, {
                        type: 'sensibleFtBalance',
                        data: preSensibleFtBalance
                    })
                }
            } catch (err) {}
            return true
        } else {
            return false
        }
    }

    const handleRequest = (method: string, fn: Function) => {
        postMsg.on(id, async function (_: any, eventData: any) {
            const {type, data} = eventData
            if (type === 'request' && data?.method === method) {
                const requestId = data.requestId
                try {
                    const res = await fn(data.params)
                    postMsg.emit(id, {
                        type: 'response',
                        data: {
                            requestId,
                            method,
                            response: res,
                        }
                    })
                } catch (err: any) {
                    postMsg.emit(id, {
                        type: 'response',
                        data: {
                            requestId,
                            method,
                            error: err.toString()
                        }
                    })
                }
            }
        })
    }

    handleRequest('getAccount', async () => {
        await requestLatestData()
        if (!preAccount) {
            return null
        }
        return {
            name: preAccount.email,
            email: preAccount.email,
            network: preAccount.network,
        }
    });
    handleRequest('getMvcBalance', async () => {
        await requestLatestData()
        return preMvcBalance
    })
    handleRequest('getSensibleFtBalance', async () => {
        await requestLatestData()
        return preSensibleFtBalance
    })
    handleRequest('getAddress', async () => {
        await requestLatestData()
        if (!accountKey) {
            return null
        }
        return accountKey.address
    })
    handleRequest('signTx', async (options: any) => {
        // 参数 (address + sighash)
        // sighash: tx, sigtype, inputIndex, input.output.script, input.output,satoshisBN

        // mvc-scrypt: signTx(tx, privateKey, lockingScriptASM: string, inputAmount: number, inputIndex: number, sighashType = DEFAULT_SIGHASH_TYPE, flags=DEFAULT_FLAGS): Signature.toTxFormat()

        // mvc: mvc.Transaction.sighash.sign(tx: Transaction, privateKey: PrivateKey, sighashType: number, inputIndex: string, subscript: Script, satoshisBN: BN): Signature

        // sCrypt params: tx(Transaciton object), inputIndex(number), sigHashType(SigType), onlySig?(boolean) 成功返回 unlockingScript 或者 Signature string

        // options: {txHex, scriptHex, inputIndex, privateKey, publicKey, address, satoshis}

        const {address} = options
        if (!accountKey) {
            throw new Error('not_login')
        }
        if (address !== accountKey.address) {
            throw new Error('not_my_address')
        }
        return signAnyTx({
            ...options,
            privateKey: new mvc.PrivateKey(accountKey.privateKey, preAccount?.network ),
            publicKey: new mvc.PublicKey(accountKey.publicKey, preAccount?.network)
        })
    })
    handleRequest('logout', async () => {
        saveAccountStorage(null)
    })
    handleRequest('ping', () => {
        return null;
    })

    for (;;) {
        const signed = await requestLatestData()
        await sleep(signed ? 3000 : 500)
    }

}