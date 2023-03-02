import {
  Button,
  Popover,
  Card,
  Form,
  Input,
  Select,
  List,
  Row,
  Col,
  message,
  InputNumber,
  Space,
  Modal,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  MinusOutlined,
  PlusOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import * as QRCode from "qrcode.react";
import { mvc } from "mvc-scrypt";
import {
  getWocAddressUrl,
  formatValue,
  isValidAddress,
  transferMvc,
  transferSensibleFt,
  getWocTransactionUrl,
  getSensibleFtHistoryUrl,
  parseTransaction,
  broadcastSensibleQeury,
} from "./lib";
import * as createPostMsg from "post-msg";
import { useGlobalState } from "./state/state";
import * as actions from "./state/action";
import { useOnceCall } from "./hooks";
import "./App.css";
import * as util from "./lib/util";
import * as Sentry from "@sentry/react";
import axios from "axios";

//const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { Option } = Select;

function Header() {
  const [account] = useGlobalState("account");
  const [key] = useGlobalState("key");
  const [decodeModalVisible, setDecodeModalVisible] = useState(false);
  const [rawtx, setRawtx] = useState("");
  const [network, setNetwork] = useState("");
  const [resultModalVisible, setResultModalVisible] = useState(false);

  const handleLogout = () => {
    actions.saveAccount(null);
  };
  const handleHistory = () => {
    let url = getWocAddressUrl(account.network, key.address);
    window.open(url);
  };
  const handleSourceCode = () => {
    window.open("https://github.com/mvc-swap/web-wallet");
  };

  const decodeTx = () => {
    const res = parseTransaction(network, rawtx);
    console.log("decodeTx res", res);
  };

  return (
    <div className="header">
      <div className="logo">Web Wallet</div>
      {account && (
        <Popover
          title=""
          content={
            <>
              <Button type="link" onClick={handleLogout}>
                Logout
              </Button>
              <br />
              <Button type="link" onClick={handleHistory}>
                History
              </Button>
              <br />
              <Button type="link" onClick={handleSourceCode}>
                Source Code
              </Button>
              <br />
              <Button type="link" onClick={() => setDecodeModalVisible(true)}>
                decode rawtx
              </Button>
            </>
          }
        >
          <Button type="link">{account.email}</Button>
        </Popover>
      )}
      <Modal
        visible={decodeModalVisible}
        onCancel={() => setDecodeModalVisible(false)}
      >
        <Input.TextArea
          rows={4}
          value={rawtx}
          onChange={(e) => setRawtx(e.target.value)}
        ></Input.TextArea>
        <Select
          style={{ width: 180 }}
          placeholder="Select network"
          value={network}
          onChange={(value) => setNetwork(value)}
        >
          <Option value="mainnet">mainnet</Option>
          <Option value="testnet">testnet</Option>
        </Select>
        <Button type="primary" onClick={decodeTx}>
          decode
        </Button>
      </Modal>
      <Modal
        visible={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
      ></Modal>
    </div>
  );
}

function LoginPanel() {
  const [account] = useGlobalState("account");
  const [form] = Form.useForm();

  const handleOnFinish = () => {
    Modal.confirm({
      title: "Attention",
      content: (
        <div>
          The private key of the web wallet is calculated in real-time through the user's email address and password, and will not be uploaded to the server or stored locally (see&nbsp; 
          <a
            href="https://github.com/mvc-swap/web-wallet"
            target="_blank"
            rel="noreferrer"
          >
            github
          </a>
          &nbsp;for the code). It is only for the convenience of user testing and is not suitable for depositing a large number of funds. It is recommended that users keep the email + password combination properly to prevent the loss of funds or transfer the remaining funds after use. Loss of mailbox + password combination (forgotten, stolen, etc.) will lead to asset loss.
        </div>
      ),
      onOk: () => {
        const account = form.getFieldsValue();
        actions.saveAccount(account);
      },
    });
  };
  if (account) {
    return null;
  }

  return (
    <Card className="card" title="Login" bordered={false}>
      <Form form={form} layout="vertical" onFinish={handleOnFinish}>
        <Form.Item
          name="email"
          rules={[
            {
              type: "email",
              required: true,
              message: "Please input a valid Email!",
            },
          ]}
        >
          <Input
            prefix={<UserOutlined className="site-form-item-icon" />}
            placeholder="Email"
          />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Please input your Password!" },
            {
              min: 6,
              message: "Password at least 6 chars",
              transform: (value) => value && value.trim(),
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="site-form-item-icon" />}
            type="password"
            visibilityToggle={true}
            placeholder="Password"
          />
        </Form.Item>
        <Form.Item name="network" label="Network" rules={[{ required: true }]}>
          <Select placeholder="Select network">
            <Option value="mainnet">mainnet</Option>
            <Option value="testnet">testnet</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          Note: The private key of the web wallet is calculated in real time through the user's email address and password (no registration required), and the same private key can be calculated every time you enter the same email address and password to log in. The private key will not be uploaded to the server, nor will it Saved locally, it is only for the convenience of users for testing, and is not suitable for storing large amounts of funds. It is recommended that users keep the email + password combination properly to prevent loss of funds. 
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            Log in
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function AccountInfoPanel({ onWithDraw, onTransfer }) {
  const [key] = useGlobalState("key");
  const [account] = useGlobalState("account");
  const [mvcBalance] = useGlobalState("mvcBalance");
  const [sensibleFtList] = useGlobalState("sensibleFtList");

  if (!key || !account) {
    return null;
  }
  const handleHistory = () => {
    let url = getWocAddressUrl(account.network, key.address);
    window.open(url);
  };
  const handleTransfer = (genesis) => {
    if (!genesis) {
      return onTransfer("");
    }
    // if (!satotxConfigMap.has(genesis)) {
    //   return message.error("rabin api not set or found");
    // }
    return onTransfer(genesis);
  };
  return [
    <Card
      className="card"
      title="Account Info"
      bordered={false}
      actions={
        <>
          <Button type="link" onClick={handleHistory}>
            history
          </Button>
          ,
          <Button type="link" onClick={onWithDraw}>
            withdraw
          </Button>
          ,
        </>
      }
    >
      <Form layout="vertical">
        <Form.Item label={`${account.network} address`}>
          <Input value={key.address} />
          <div style={{ margin: 20 }}>
            <QRCode value={key.address} />
          </div>
        </Form.Item>
        <Form.Item label="privateKey">
          <Input.Password visibilityToggle={true} value={key.privateKey} />
        </Form.Item>
      </Form>
    </Card>,
    <Card className="card" title="Asset" bordered={false}>
      <Form layout="vertical">
        {mvcBalance && (
          <Form.Item label="SPACE balance">
            <Row justify="space-between">
              <Col span={16}>
                <div>{formatValue(mvcBalance.balance, 8)}</div>
              </Col>
              <Col span={7}>
                <Button type="link" onClick={() => handleTransfer("")}>
                  Transfer SPACE
                </Button>
              </Col>
            </Row>
          </Form.Item>
        )}
        {sensibleFtList.length > 0 && (
          <Form.Item label="Fungible Token">
            <List
              itemLayout="horizontal"
              dataSource={sensibleFtList}
              renderItem={(item) => {
                return (
                  <List.Item
                    key={item.genesis}
                    actions={
                      <>
                        <Popover
                          placement="topRight"
                          content={
                            <>
                              <div>codehash: {item.codehash}</div>,
                              <div>genesis: {item.genesis}</div>,
                            </>
                          }
                        >
                          <a
                            key="list-loadmore-more"
                            href={getSensibleFtHistoryUrl(
                              account.network,
                              key.address,
                              item.genesis,
                              item.codehash
                            )}
                            rel="noreferrer"
                            target="_blank"
                          >
                            more info
                          </a>
                        </Popover>
                      </>
                    }
                  >
                    <List.Item.Meta
                      title={item.tokenSymbol}
                      description={item.tokenName}
                    />
                    <Row>
                      <Col>
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          Balance:{" "}
                          {formatValue(item.balance, item.tokenDecimal)}
                        </div>
                      </Col>
                      <Col>
                        <Button
                          type="link"
                          onClick={() => handleTransfer(item.genesis)}
                        >
                          Go Transfer
                        </Button>
                      </Col>
                    </Row>
                  </List.Item>
                );
              }}
            ></List>
          </Form.Item>
        )}
      </Form>
    </Card>,
  ];
}

function getRabinPubKeys(url) {
  return axios.get(url);
}

async function getRabins(rabinApis = []) {
  let promises = [],
    rabins = [];
  rabinApis.forEach((rabinApi) => {
    promises.push(getRabinPubKeys(rabinApi));
  });
  return new Promise((resolve) => {
    axios.all(promises).then((res) => {
      // console.log(res);
      res.forEach((item, index) => {
        rabins.push({
          satotxApiPrefix: rabinApis[index],
          satotxPubKey: item.data.data.pubKey,
        });
      });

      resolve(rabins);
    });
  });
}

function TransferAllPanel({ initDatas = [], onCancel, onTransferCallback }) {
  const [key] = useGlobalState("key");
  const [mvcBalance] = useGlobalState("mvcBalance");
  const [account] = useGlobalState("account");
  const [sensibleFtList] = useGlobalState("sensibleFtList");
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useOnceCall(() => {
    const values = {};
    initDatas.forEach((data, index) => {
      const isMvc = !data.genesis;
      const token = sensibleFtList.find(
        (item) => item.genesis === data.genesis
      );
      const decimal = isMvc ? 8 : token.tokenDecimal;
      values[`receiverList${index}`] = data.receivers.map((item) => {
        return {
          address: item.address,
          amount: util.div(item.amount, util.getDecimalString(decimal)),
        };
      });
    });
    form.setFieldsValue(values);
  }, key && mvcBalance);

  if (!key) {
    return null;
  }
  if (!mvcBalance) {
    return null;
  }

  const handleSubmit = async () => {
    const receiverLists = form.getFieldsValue();

    const broadcastMvc = async ({ formatReceiverList, noBroadcast }) => {
      setLoading(true);
      let transferRes;
      let txid = "";
      try {
        if (noBroadcast === true) {
          const allUtxos = true;
          const tx = await await transferMvc(
            account.network,
            key.privateKey,
            formatReceiverList,
            noBroadcast,
            allUtxos
          );
          return tx;
        }
        const res = await await transferMvc(
          account.network,
          key.privateKey,
          formatReceiverList
        );
        transferRes = res;
        txid = res.txid;
      } catch (err) {
        const msg = "broadcast error: " + err.toString();
        Sentry.captureException(err);
        Sentry.captureMessage(`mvcTransferFail_${key.address}`);
        onTransferCallback({
          error: msg,
        });
        console.log("broadcast mvc error ");
        console.error(err);
        message.error(err.toString());
      }
      Sentry.captureMessage(`mvcTransferSuccess_${key.address}_${txid}`);
      return transferRes;
    };

    const broadcastSensibleFt = async ({
      formatReceiverList,
      token,
      decimal,
      genesis,
      rabinApis,
      utxos,
      noBroadcast,
    }) => {
      setLoading(true);
      let transferRes;
      try {
        const rabins = await getRabins(rabinApis);
        const res = await transferSensibleFt(
          account.network,
          // signers,
          rabins,
          key.privateKey,
          formatReceiverList,
          token.codehash,
          token.genesis,
          utxos,
          noBroadcast || false
        );
        transferRes = res;
      } catch (err) {
        Sentry.captureException(err);
        Sentry.captureMessage(
          `ftTransferFail_${key.address}_${token.genesis}_${token.genesis}`
        );
        onTransferCallback({
          error: "broadcast sensible ft error, " + err.toString(),
        });
        console.log("broadcast sensible ft error ");
        console.error(err);
        message.error(err.toString());
      }
      return transferRes;
    };

    const broadcastMvcAndToken = async () => {
      const txs = [];
      const transferRes = [];
      let utxos = [];
      // mvc transaction must be the first one
      for (let i = 0; i < initDatas.length; i++) {
        const data = initDatas[i];
        const isMvc = !data.genesis;
        const token = sensibleFtList.find(
          (item) => item.genesis === data.genesis
        );
        const decimal = isMvc ? 8 : token.tokenDecimal;
        const balance = isMvc ? mvcBalance.balance : token.balance;
        const rabinApis = data.rabinApis;
        const totalOutputValueFloatDuck = receiverLists[
          `receiverList${i}`
        ].reduce((prev, cur) => util.plus(prev, cur.amount), 0);

        const totalOutputValue = util.multi(
          totalOutputValueFloatDuck,
          util.getDecimalString(decimal)
        );
        if (util.lessThan(balance, totalOutputValue)) {
          const msg = "Insufficient ft balance";
          onTransferCallback({
            error: msg,
          });
          return message.error(msg);
        }
        const formatReceiverList = data.receivers.map((item) => {
          return {
            address: item.address,
            // amount: util.multi(item.amount, util.getDecimalString(decimal)),
            amount: item.amount,
          };
        });
        if (isMvc) {
          const tx = await broadcastMvc({
            formatReceiverList,
            noBroadcast: true,
          });
          const outputIndex = tx.outputs.length - 1;
          //TODO: check res outputs
          if (outputIndex !== 1) {
            const msg = "Insufficient ft balance";
            onTransferCallback({
              error: msg,
            });
            return message.error(msg);
          }
          const output = tx.outputs[outputIndex];
          txs.push({
            tx: tx,
            isMvc: true,
            noBroadcast: !!data.noBroadcast,
          });
          utxos = [];
          utxos.push({
            txId: tx.id,
            outputIndex,
            satoshis: output.satoshis,
            wif: key.privateKey,
            address: new mvc.PrivateKey(
              key.privateKey,
              account.network
            ).toAddress(account.network),
          });
        } else {
          const { routeCheckTx, tx } = await broadcastSensibleFt({
            formatReceiverList,
            token,
            decimal,
            genesis: data.genesis,
            rabinApis,
            utxos,
            noBroadcast: true,
          });
          txs.push({
            tx,
            routeCheckTx,
            isMvc: false,
            noBroadcast: !!data.noBroadcast,
          });
          const outputIndex = tx.outputs.length - 1;
          const output = tx.outputs[outputIndex];
          utxos = [];
          utxos.push({
            txId: tx.id,
            outputIndex,
            satoshis: output.satoshis,
            wif: key.privateKey,
            address: new mvc.PrivateKey(
              key.privateKey,
              account.network
            ).toAddress(account.network),
          });
        }
      }

      for (const txInfo of txs) {
        if (!txInfo.noBroadcast) {
          if (txInfo.routeCheckTx) {
            await broadcastSensibleQeury(
              account.network,
              txInfo.routeCheckTx.serialize(true)
            );
          }
          if (txInfo.tx) {
            await broadcastSensibleQeury(
              account.network,
              txInfo.tx.serialize(true)
            );
          }
        }

        var resItem = {
          txid: txInfo.tx.hash,
          outputs: parseTransaction(account.network, txInfo.tx.serialize(true))
            .outputs,
          fee: txInfo.tx.getFee(),
          isMvc: txInfo.isMvc,
          txHex: txInfo.tx.serialize(true),
        };
        if (!resItem.isMvc) {
          resItem.routeCheckTxid = txInfo.routeCheckTx.hash;
          resItem.routeCheckTxHex = txInfo.routeCheckTx.serialize(true);
          resItem.routeCheckOutputs = parseTransaction(
            account.network,
            txInfo.routeCheckTx.serialize(true)
          ).outputs;
        }

        transferRes.push(resItem);
      }

      setLoading(false);
      onTransferCallback({
        response: {
          ...transferRes,
        },
      });
    };

    const buildMvcAndTokenTx = async () => {
      const txs = {};
      let utxos = [];
      // mvc transaction must be the first one
      for (let i = 0; i < initDatas.length; i++) {
        const data = initDatas[i];
        const isMvc = !data.genesis;
        const token = sensibleFtList.find(
          (item) => item.genesis === data.genesis
        );
        const decimal = isMvc ? 8 : token.tokenDecimal;
        const balance = isMvc ? mvcBalance.balance : token.balance;
        const rabinApis = data.rabinApis;
        const totalOutputValueFloatDuck = receiverLists[
          `receiverList${i}`
        ].reduce((prev, cur) => util.plus(prev, cur.amount), 0);

        const totalOutputValue = util.multi(
          totalOutputValueFloatDuck,
          util.getDecimalString(decimal)
        );
        if (util.lessThan(balance, totalOutputValue)) {
          const msg = "Insufficient ft balance";
          onTransferCallback({
            error: msg,
          });
          return message.error(msg);
        }
        const formatReceiverList = data.receivers.map((item) => {
          return {
            address: item.address,
            // amount: util.multi(item.amount, util.getDecimalString(decimal)),
            amount: item.amount,
          };
        });
        if (isMvc) {
          const tx = await broadcastMvc({
            formatReceiverList,
            noBroadcast: true,
          });
          const outputIndex = tx.outputs.length - 1;
          //TODO: check res outputs
          if (outputIndex !== 1) {
            const msg = "Insufficient ft balance";
            onTransferCallback({
              error: msg,
            });
            return message.error(msg);
          }
          const output = tx.outputs[outputIndex];
          txs.mvcRawTx = tx.toString();
          utxos = [];
          utxos.push({
            txId: tx.id,
            outputIndex,
            satoshis: output.satoshis,
            wif: key.privateKey,
            address: new mvc.PrivateKey(
              key.privateKey,
              account.network
            ).toAddress(account.network),
          });
        } else {
          const { amountCheckTx, tx } = await broadcastSensibleFt({
            formatReceiverList,
            token,
            decimal,
            genesis: data.genesis,
            rabinApis,
            utxos,
            noBroadcast: true,
          });
          txs.amountCheckRawTx = amountCheckTx.toString();
          txs.tokenRawTx = tx.toString();
          const outputIndex = tx.outputs.length - 1;
          const output = tx.outputs[outputIndex];
          utxos = [];
          utxos.push({
            txId: tx.id,
            outputIndex,
            satoshis: output.satoshis,
            wif: key.privateKey,
            address: new mvc.PrivateKey(
              key.privateKey,
              account.network
            ).toAddress(account.network),
          });
        }
      }

      setLoading(false);
      onTransferCallback({
        response: txs,
      });
    };

    Modal.confirm({
      title: "Confirm the transaction",
      onOk: () => {
        //broadcastAll();
        broadcastMvcAndToken();
      },
    });
  };
  const handleBack = () => {
    onCancel();
  };
  return (
    <Card
      className="card"
      title={
        <div style={{ cursor: "pointer" }} onClick={handleBack}>
          <LeftOutlined />
          Transfer
        </div>
      }
      loading={loading}
      bordered={false}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {initDatas.map((data, index) => {
          const isMvc = !data.genesis;
          const token = sensibleFtList.find(
            (item) => item.genesis === data.genesis
          );

          if (!isMvc && !token) {
            return null;
          }
          const tokenSymbol = isMvc ? "SPACE" : token.tokenSymbol;
          const decimal = isMvc ? 8 : token.tokenDecimal;
          const balance = isMvc ? mvcBalance.balance : token.balance;
          const formatBalance = formatValue(balance, decimal);
          const canEdit = !(data.receivers.length > 0);
          return (
            <div key={index}>
              <div className="transfer-line">
                {isMvc ? `Coin: ${tokenSymbol}` : `Token: ${tokenSymbol}`}
              </div>
              {!isMvc && (
                <div className="transfer-line">Genesis: {token.genesis}</div>
              )}
              {!isMvc && (
                <div className="transfer-line">Codehash: {token.codehash}</div>
              )}
              <Row justify="space-between" style={{ margin: "10px 0" }}>
                <Col span={14}>
                  <div style={{ fontWeight: 700 }}>Input</div>
                </Col>
              </Row>
              <div className="transfer-line">{`Balance: ${formatBalance}`}</div>
              <div className="transfer-line">{`From Address: ${key.address}`}</div>
              <Row justify="space-between" style={{ margin: "10px 0" }}>
                <Col span={14}>
                  <div style={{ fontWeight: 700 }}>Output</div>
                </Col>
              </Row>
              <Form.List name={`receiverList${index}`}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((key, name, fieldKey, ...restField) => {
                      return (
                        <Space
                          key={key.fieldKey}
                          style={{ display: "flex", marginBottom: 8 }}
                          align="baseline"
                        >
                          <Form.Item
                            {...restField}
                            name={[name, "address"]}
                            fieldKey={[fieldKey, "address"]}
                            rules={[
                              {
                                required: true,
                                message: "Please input the address",
                              },
                              {
                                message: "invalid address",
                                validator: (_, value) =>
                                  isValidAddress(account.network, value)
                                    ? Promise.resolve()
                                    : Promise.reject(),
                              },
                            ]}
                          >
                            <Input
                              placeholder="Input the address"
                              disabled={!canEdit}
                            />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, "amount"]}
                            fieldKey={[fieldKey, "amount"]}
                            rules={[
                              {
                                required: true,
                                message: "Please input amount",
                              },
                            ]}
                          >
                            <InputNumber
                              placeholder="Amount"
                              min={0}
                              disabled={!canEdit}
                            />
                          </Form.Item>
                          <Button
                            disabled={!canEdit}
                            size="small"
                            onClick={() => remove(name)}
                            shape="circle"
                            icon={<MinusOutlined />}
                          />
                        </Space>
                      );
                    })}

                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        icon={<PlusOutlined />}
                        disabled={!canEdit}
                      >
                        Add Output
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </div>
          );
        })}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Transfer
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function TransferPanel({
  genesis = "",
  initReceivers = [],
  rabinApis = [],
  onCancel,
  onTransferCallback,
  noBroadcast,
}) {
  const [key] = useGlobalState("key");
  const [mvcBalance] = useGlobalState("mvcBalance");
  const [account] = useGlobalState("account");
  const [sensibleFtList] = useGlobalState("sensibleFtList");
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const canEdit = !(initReceivers.length > 0);

  useOnceCall(() => {
    const isMvc = genesis === "";
    const token = sensibleFtList.find((item) => item.genesis === genesis);
    const decimal = isMvc ? 8 : token.tokenDecimal;
    console.log(
      "initReceivers",
      initReceivers,
      initReceivers.map((item) => {
        return {
          address: item.address,
          amount: util.multi(item.amount, util.getDecimalString(decimal)),
        };
      })
    );
    form.setFieldsValue({
      receiverList: initReceivers.map((item) => {
        return {
          address: item.address,
          amount: util.div(item.amount, util.getDecimalString(decimal)),
        };
      }),
    });
  }, key && mvcBalance && initReceivers.length);

  if (!key) {
    return null;
  }
  if (!mvcBalance) {
    return null;
  }
  if (genesis && !sensibleFtList.length) {
    return null;
  }

  const isMvc = genesis === "";
  const token = sensibleFtList.find((item) => item.genesis === genesis);

  if (!isMvc && !token) {
    return null;
  }
  const tokenSymbol = isMvc ? "SPACE" : token.tokenSymbol;
  const decimal = isMvc ? 8 : token.tokenDecimal;
  const balance = isMvc ? mvcBalance.balance : token.balance;
  const formatBalance = formatValue(balance, decimal);

  const handleSubmit = async () => {
    const { receiverList } = form.getFieldsValue();
    const totalOutputValueFloatDuck = receiverList.reduce(
      (prev, cur) => util.plus(prev, cur.amount),
      0
    );

    const totalOutputValue = util.multi(
      totalOutputValueFloatDuck,
      util.getDecimalString(decimal)
    );
    if (util.lessThan(balance, totalOutputValue)) {
      const msg = "Insufficient ft balance";
      onTransferCallback({
        error: msg,
      });
      return message.error(msg);
    }
    const formatReceiverList = receiverList.map((item) => {
      return {
        address: item.address,
        amount: util.multi(item.amount, util.getDecimalString(decimal)),
      };
    });

    const broadcastMvc = async () => {
      setLoading(true);
      let txid = "";
      let transferRes;
      try {
        const res = await transferMvc(
          account.network,
          key.privateKey,
          formatReceiverList,
          noBroadcast
        );
        if (noBroadcast) {
          transferRes = {
            txid: res.hash,
            txHex: res.serialize(true),
            outputs: parseTransaction(account.network, res.serialize(true))
              .outputs,
            fee: res.getFee(),
          };
          txid = res.hash;
        } else {
          transferRes = res;
          txid = res.txid;
        }
      } catch (err) {
        const msg = "broadcast error: " + err.toString();
        console.log(
          util.safeJsonStringify({
            type: "mvcTransferFail",
            msg,
            account: {
              network: account.network,
              address: key.address,
            },
            receivers: formatReceiverList,
          })
        );
        Sentry.captureException(err);
        Sentry.captureMessage(`mvcTransferFail_${key.address}`);
        onTransferCallback({
          error: msg,
        });
        console.log("broadcast mvc error ");
        console.error(err);
        message.error(err.toString());
      }
      setLoading(false);
      if (txid) {
        console.log(
          util.safeJsonStringify({
            type: "mvcTransferSuccess",
            account: {
              network: account.network,
              address: key.address,
            },
            receivers: formatReceiverList,
            txid,
            ...transferRes,
          })
        );
        Sentry.captureMessage(`mvcTransferSuccess_${key.address}_${txid}`);
        onTransferCallback({
          response: {
            ...transferRes,
          },
        });
        Modal.success({
          title: "Transaction broadcast success",
          content: (
            <div>
              txid:{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href={getWocTransactionUrl(account.network, txid)}
              >
                {txid}
              </a>
            </div>
          ),
        });
      }
    };

    const broadcastSensibleFt = async () => {
      setLoading(true);
      let txid = "";
      let transferRes;
      try {
        const rabins = await getRabins(rabinApis);

        const res = await transferSensibleFt(
          account.network,
          // signers,
          rabins,
          key.privateKey,
          formatReceiverList,
          token.codehash,
          token.genesis,
          false,
          noBroadcast
        );
        if (noBroadcast) {
          transferRes = {
            txid: res.tx.hash,
            outputs: parseTransaction(account.network, res.tx.serialize(true))
              .outputs,
            fee: res.tx.getFee(),
            routeCheckTxid: res.routeCheckTx.hash,
            txHex: res.tx.serialize(true),
            routeCheckTxHex: res.routeCheckTx.serialize(true),
            routeCheckOutputs: parseTransaction(
              account.network,
              res.routeCheckTx.serialize(true)
            ).outputs,
          };
          txid = res.tx.hash;
        } else {
          transferRes = res;
          txid = res.txid;
        }
      } catch (err) {
        console.log("broadcast sensible ft error ");
        console.error(err);
        message.error(err.toString());
        console.log(
          util.safeJsonStringify({
            type: "ftTransferFail",
            msg: util.safeJsonStringify(err.message),
            account: {
              network: account.network,
              address: key.address,
            },
            genesis: token.genesis,
            codehash: token.codehash,
            receivers: formatReceiverList,
          })
        );
        Sentry.captureException(err);
        Sentry.captureMessage(
          `ftTransferFail_${key.address}_${token.genesis}_${token.genesis}`
        );
        onTransferCallback({
          error: err.toString(),
        });
      }
      setLoading(false);
      if (txid) {
        console.log(
          util.safeJsonStringify({
            type: "ftTransferSuccess,",
            account: {
              network: account.network,
              address: key.address,
              genesis: token.genesis,
              codehash: token.codehash,
            },
            receivers: formatReceiverList,
            txid,
            ...transferRes,
          })
        );
        Sentry.captureMessage(`ftTransferSuccess_${key.address}_${txid}`);
        onTransferCallback({
          response: {
            ...transferRes,
          },
        });
        Modal.success({
          title: "Transaction broadcast success",
          content: (
            <div>
              txid:{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href={getWocTransactionUrl(account.network, txid)}
              >
                {txid}
              </a>
            </div>
          ),
        });
      }
    };

    Modal.confirm({
      title: "Confirm the transaction",
      onOk: () => {
        isMvc ? broadcastMvc() : broadcastSensibleFt();
      },
    });
  };
  const handleBack = () => {
    onCancel();
  };

  return (
    <Card
      className="card"
      title={
        <div style={{ cursor: "pointer" }} onClick={handleBack}>
          <LeftOutlined />
          Transfer
        </div>
      }
      loading={loading}
      bordered={false}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div className="transfer-line">
          {isMvc ? `Coin: ${tokenSymbol}` : `Token: ${tokenSymbol}`}
        </div>
        {!isMvc && (
          <div className="transfer-line">Genesis: {token.genesis}</div>
        )}
        {!isMvc && (
          <div className="transfer-line">Codehash: {token.codehash}</div>
        )}
        <Row justify="space-between" style={{ margin: "10px 0" }}>
          <Col span={14}>
            <div style={{ fontWeight: 700 }}>Input</div>
          </Col>
        </Row>
        <div className="transfer-line">{`Balance: ${formatBalance}`}</div>
        <div className="transfer-line">{`From Address: ${key.address}`}</div>
        <Row justify="space-between" style={{ margin: "10px 0" }}>
          <Col span={14}>
            <div style={{ fontWeight: 700 }}>Output</div>
          </Col>
        </Row>
        <Form.List name="receiverList">
          {(fields, { add, remove }) => (
            <>
              {fields.map((key, name, fieldKey, ...restField) => {
                return (
                  <Space
                    key={key.fieldKey}
                    style={{ display: "flex", marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "address"]}
                      fieldKey={[fieldKey, "address"]}
                      rules={[
                        {
                          required: true,
                          message: "Please input the address",
                        },
                        {
                          message: "invalid address",
                          validator: (_, value) =>
                            isValidAddress(account.network, value)
                              ? Promise.resolve()
                              : Promise.reject(),
                        },
                      ]}
                    >
                      <Input
                        placeholder="Input the address"
                        disabled={!canEdit}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "amount"]}
                      fieldKey={[fieldKey, "amount"]}
                      rules={[
                        { required: true, message: "Please input amount" },
                      ]}
                    >
                      <InputNumber
                        placeholder="Amount"
                        min={0}
                        disabled={!canEdit}
                      />
                    </Form.Item>
                    <Button
                      disabled={!canEdit}
                      size="small"
                      onClick={() => remove(name)}
                      shape="circle"
                      icon={<MinusOutlined />}
                    />
                  </Space>
                );
              })}

              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  disabled={!canEdit}
                >
                  Add Output
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Transfer
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function App() {
  useEffect(() => {
    actions.recoverAccountFromStorage();
  }, []);

  const [trasfering, setTransfering] = useState(false);
  const [trasferSensibleFtGenesis, setTrasferSensibleFtGenesis] = useState("");
  const [account] = useGlobalState("account");
  const [key] = useGlobalState("key");
  const [mvcBalance] = useGlobalState("mvcBalance");
  const [sensibleFtList] = useGlobalState("sensibleFtList");
  const [initReceivers, setInitReceivers] = useState([]);
  const [initDatas, setInitDatas] = useState([]);
  const [initRabins, setRabins] = useState([]);
  const [initNoBroadcast, setInitNoBroadcast] = useState(false);

  const handleTransfer = (genesis) => {
    setTransfering(true);
    genesis && setTrasferSensibleFtGenesis(genesis);
  };
  const handleCancelTransfer = () => {
    setTransfering(false);
    setTrasferSensibleFtGenesis("");
  };

  const getHashData = () => {
    if (!window.opener) {
      return null;
    }
    const hash = window.location.hash.substr(1);
    try {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.type === "popup") {
        if (typeof data.data === "object") {
          return data;
        }
      }
    } catch (err) {}
    return null;
  };
  const handlePopResponseCallback = (resObj) => {
    const data = getHashData();
    if (!data) {
      return;
    }
    const postMsg = createPostMsg(window.opener, "*");
    postMsg.emit(data.id, {
      type: "response",
      data: {
        ...data.data.data,
        ...resObj,
      },
    });
  };

  // todo 数值计算 使用 bignumber
  // todo 此处接收 postMessage 消息，处理登录,transfer
  const requestAccountCondition = key?.address && account?.network;
  const transferMvcCondition =
    requestAccountCondition &&
    mvcBalance &&
    util.greaterThanEqual(mvcBalance.balance, 0);
  useOnceCall(() => {
    const data = getHashData();
    if (!data || data.data.type !== "request") {
      return;
    }

    const { method, params } = data.data.data;
    if (method !== "requestAccount") {
      return;
    }
    Modal.confirm({
      title: "Connect",
      content: (
        <div>
          Allow <b>{params.name}</b> to connect your web wallet
        </div>
      ),
      onOk: () => {
        handlePopResponseCallback({ response: true });
      },
      onCancel: () => {
        handlePopResponseCallback({ error: "user reject" });
      },
    });
  }, !!requestAccountCondition);
  useOnceCall(() => {
    const data = getHashData();
    console.log("mvc hash data", data);
    if (!data || data.data.type !== "request") {
      return;
    }

    const { method, params } = data.data.data;
    if (method !== "transferMvc") {
      return;
    }
    // balance check
    const outputTotal = params.receivers.reduce(
      (prev, cur) => util.plus(prev, cur.amount),
      0
    );
    if (util.greaterThan(outputTotal, mvcBalance.balance)) {
      handlePopResponseCallback({ error: "insufficient mvc balance" });
      return;
    }
    setTransfering(true);
    setInitReceivers(params.receivers);
    setInitNoBroadcast(params.noBroadcast);
  }, !!transferMvcCondition);
  useOnceCall(() => {
    const data = getHashData();
    console.log("hashdata", data);
    if (!data || data.data.type !== "request") {
      return;
    }

    const { method, params } = data.data.data;
    if (method !== "transferSensibleFt") {
      return;
    }
    // sensibleft balance check
    const outputTotal = params.receivers.reduce(
      (prev, cur) => util.plus(prev, cur.amount),
      0
    );
    console.log("outputTotal", outputTotal);
    const ft = sensibleFtList.find((item) => item.genesis === params.genesis);
    console.log("ft", ft);
    if (!ft) {
      handlePopResponseCallback({ error: "insufficient ft balance" });
      return;
    }
    if (util.greaterThan(outputTotal, ft.balance)) {
      handlePopResponseCallback({ error: "insufficient ft balance" });
      return;
    }
    setTransfering(true);
    setTrasferSensibleFtGenesis(params.genesis);
    setInitReceivers(params.receivers);
    setRabins(params.rabinApis);
    setInitNoBroadcast(params.noBroadcast);
  }, !!transferMvcCondition);
  useOnceCall(() => {
    const data = getHashData();
    console.log("mvc hash data", data);
    if (!data || data.data.type !== "request") {
      return;
    }

    const { method, params } = data.data.data;
    if (method !== "transferAll") {
      return;
    }
    // balance check
    params.datas.forEach((item) => {
      // balance check
      const isMvc = !item.genesis;
      const ft = sensibleFtList.find((v) => v.genesis === item.genesis);

      const outputTotal = item.receivers.reduce(
        (prev, cur) => util.plus(prev, cur.amount),
        0
      );
      if (isMvc && util.greaterThan(outputTotal, mvcBalance.balance)) {
        handlePopResponseCallback({ error: "insufficient mvc balance" });
        return;
      }
      if (ft && util.greaterThan(outputTotal, ft.balance)) {
        handlePopResponseCallback({ error: "insufficient ft balance" });
        return;
      }
      setTransfering(true);
      setInitDatas(params.datas);
    });
  }, !!transferMvcCondition);
  useEffect(() => {
    const obu = window.onbeforeunload;
    window.onbeforeunload = function (event) {
      handlePopResponseCallback({ error: "use closed" });
      return obu && obu(event);
    };
  });
  return (
    <div className="App" style={{ overflow: "hidden" }}>
      <Header accountName="harry" />
      <LoginPanel />
      {!trasfering && <AccountInfoPanel onTransfer={handleTransfer} />}
      {trasfering &&
        (!initDatas || initDatas.length < 1 ? (
          <TransferPanel
            genesis={trasferSensibleFtGenesis}
            rabinApis={initRabins}
            onCancel={handleCancelTransfer}
            onTransferCallback={handlePopResponseCallback}
            initReceivers={initReceivers}
            noBroadcast={initNoBroadcast}
          />
        ) : (
          <TransferAllPanel
            onCancel={handleCancelTransfer}
            onTransferCallback={handlePopResponseCallback}
            initDatas={initDatas}
          />
        ))}
    </div>
  );
}

export default App;
