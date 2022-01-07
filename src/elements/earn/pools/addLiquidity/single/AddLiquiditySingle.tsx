import { Pool, Token } from 'services/observables/tokens';
import { Widget } from 'components/widgets/Widget';
import { AddLiquiditySingleInfoBox } from './AddLiquiditySingleInfoBox';
import { AddLiquiditySingleSelectPool } from './AddLiquiditySingleSelectPool';
import { AddLiquiditySingleSpaceAvailable } from 'elements/earn/pools/addLiquidity/single/AddLiquiditySingleSpaceAvailable';
import { useAppSelector } from 'redux/index';
import { AddLiquiditySingleAmount } from 'elements/earn/pools/addLiquidity/single/AddLiquiditySingleAmount';
import { useCallback, useState } from 'react';
import { useApproveModal } from 'hooks/useApproveModal';
import { AddLiquiditySingleCTA } from 'elements/earn/pools/addLiquidity/single/AddLiquiditySingleCTA';
import { useDispatch } from 'react-redux';
import { prettifyNumber } from 'utils/helperFunctions';
import BigNumber from 'bignumber.js';
import { getTokenById } from 'redux/bancor/bancor';
import { addLiquiditySingle } from 'services/web3/liquidity/liquidity';
import {
  addLiquiditySingleFailedNotification,
  addLiquiditySingleNotification,
  rejectNotification,
} from 'services/notifications/notifications';
import { useNavigation } from 'services/router';
import { ApprovalContract } from 'services/web3/approval';
import { EthNetworks } from '../../../../../services/web3/types';
import {
  LiquidityEvents,
  sendLiquidityEvent,
} from '../../../../../services/api/googleTagManager';
import { useWeb3React } from '@web3-react/core';

interface Props {
  pool: Pool;
}

export const AddLiquiditySingle = ({ pool }: Props) => {
  const { chainId } = useWeb3React();
  const dispatch = useDispatch();
  const tkn = useAppSelector<Token | undefined>(
    getTokenById(pool.reserves[0].address)
  );
  const bnt = useAppSelector<Token | undefined>(
    getTokenById(pool.reserves[1].address)
  );
  const fiatToggle = useAppSelector<boolean>((state) => state.user.usdToggle);
  const { pushPortfolio, pushPools, pushLiquidityError } = useNavigation();
  const [isBNTSelected, setIsBNTSelected] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [spaceAvailableBnt, setSpaceAvailableBnt] = useState('');
  const [spaceAvailableTkn, setSpaceAvailableTkn] = useState('');

  const selectedToken = isBNTSelected ? bnt! : tkn!;
  const setSelectedToken = useCallback(
    (token: Token) => {
      const isBNT = token.address === bnt!.address;
      setIsBNTSelected(isBNT);
    },
    [bnt]
  );

  const handleAmountChange = (amount: string, tkn?: Token) => {
    setAmount(amount);
    const usdAmount = new BigNumber(amount)
      .times(tkn ? tkn.usdPrice! : selectedToken.usdPrice!)
      .toString();
    setAmountUsd(usdAmount);
  };

  const addProtection = async () => {
    const cleanAmount = prettifyNumber(amount);
    const gtmEvent = {
      liquidity_type: 'Add Protection',
      liquidity_blockchain_network:
        chainId === EthNetworks.Ropsten ? 'Ropsten' : 'MainNet',
      liquidity_poolName: pool.name,
      liquidity_tkn_symbol: selectedToken.symbol,
      liquidity_tkn_amount: amount,
      liquidity_tkn_amount_usd: amountUsd,
      liquidity_input_type: fiatToggle ? 'Fiat' : 'Token',
    };
    sendLiquidityEvent(LiquidityEvents.click, 'Add', gtmEvent);
    await addLiquiditySingle(
      pool,
      selectedToken,
      amount,
      (txHash: string) =>
        addLiquiditySingleNotification(
          dispatch,
          txHash,
          cleanAmount,
          selectedToken.symbol,
          pool.name
        ),
      () => {
        sendLiquidityEvent(LiquidityEvents.success, 'Add', gtmEvent);
        if (window.location.pathname.includes(pool.pool_dlt_id))
          pushPortfolio();
      },
      () => {
        sendLiquidityEvent(LiquidityEvents.fail, 'Add', {
          ...gtmEvent,
          error: 'Transaction rejected by user',
        });
        rejectNotification(dispatch);
      },
      (msg) => {
        sendLiquidityEvent(LiquidityEvents.fail, 'Add', {
          ...gtmEvent,
          error: msg,
        });
        addLiquiditySingleFailedNotification(
          dispatch,
          cleanAmount,
          selectedToken.symbol,
          pool.name
        );
      }
    );
  };

  const [onStart, ModalApprove] = useApproveModal(
    [{ amount, token: selectedToken }],
    addProtection,
    ApprovalContract.LiquidityProtection
  );

  const handleError = useCallback(() => {
    if (errorMsg) return errorMsg;
    if (!spaceAvailableBnt || !spaceAvailableTkn) {
      return '';
    }
    if (selectedToken.symbol === 'BNT') {
      const isSpaceAvailable = new BigNumber(spaceAvailableBnt).gte(
        amount || 0
      );
      if (isSpaceAvailable) {
        return '';
      } else {
        return 'Not enough space available';
      }
    } else {
      const isSpaceAvailable = new BigNumber(spaceAvailableTkn).gte(
        amount || 0
      );
      if (isSpaceAvailable) {
        return '';
      } else {
        return 'Not enough space available';
      }
    }
  }, [
    amount,
    errorMsg,
    selectedToken.symbol,
    spaceAvailableBnt,
    spaceAvailableTkn,
  ]);
  if (!tkn) {
    pushLiquidityError();
    return <></>;
  }

  return (
    <Widget title="Add Liquidity" subtitle="Single-Sided" goBack={pushPools}>
      <AddLiquiditySingleInfoBox />
      <div className="px-10">
        <AddLiquiditySingleSelectPool pool={pool} />
        <AddLiquiditySingleAmount
          pool={pool}
          amount={amount}
          setAmount={setAmount}
          amountUsd={amountUsd}
          setAmountUsd={setAmountUsd}
          token={selectedToken}
          setToken={setSelectedToken}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
        />
      </div>
      <AddLiquiditySingleSpaceAvailable
        pool={pool}
        token={tkn}
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
        setAmount={handleAmountChange}
        spaceAvailableBnt={spaceAvailableBnt}
        setSpaceAvailableBnt={setSpaceAvailableBnt}
        spaceAvailableTkn={spaceAvailableTkn}
        setSpaceAvailableTkn={setSpaceAvailableTkn}
      />
      <AddLiquiditySingleCTA
        onStart={onStart}
        amount={amount}
        errorMsg={handleError()}
      />
      {ModalApprove}
    </Widget>
  );
};
