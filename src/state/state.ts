import { createGlobalState } from "react-hooks-global-state";
import {State} from './stateType'

// app state
const initialState: State = {
    account: null,
    key: null,
    mvcBalance: null,
    sensibleFtList: [],
};
const { useGlobalState, getGlobalState, setGlobalState } = createGlobalState(initialState);

export {
    useGlobalState,
    getGlobalState,
    setGlobalState,
}
