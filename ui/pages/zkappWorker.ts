import {
  Mina,
  isReady,
  PublicKey,
  fetchAccount,
  PrivateKey,
  AccountUpdate,
  Permissions,
  Field,
  Poseidon,
  VerificationKey,
} from 'snarkyjs';

import geohash from 'ngeohash';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import { SchnitzelHuntApp } from '../../contracts/src/Schnitzel';
import { LocationCheck, MerkleWitness, Solution1Tree, Solution2Tree, Solution3Tree } from '../../contracts/src/Schnitzel.js';

// let MyMerkleWitness = MerkleWitness(8);

const state = {
  doProof: false,
  SchnitzelHuntApp: null as null | typeof SchnitzelHuntApp,
  zkapp: null as null | SchnitzelHuntApp,
  transaction: null as null | Transaction,
  privateKey: null as null | PrivateKey,
  feePayer: null as null | PrivateKey,
  verificationKey: null as any,
  publicKey: null as null | PublicKey,
}

// ---------------------------------------------------------------------------------------


const functions = {
  loadSnarkyJS: async (args: {}) => {
    await isReady;
    console.log("Snarkjy js is ready!");
  },
  setActiveInstanceToLocal: async (args: {}) => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);
    state.feePayer = Local.testAccounts[0].privateKey;
    const zkappAccountKey = PrivateKey.random();
    const zkAppAccountAddress = zkappAccountKey.toPublicKey();
    state.privateKey = zkappAccountKey;
    state.publicKey = zkAppAccountAddress;
    return zkAppAccountAddress;
  },
  loadContract: async (args: {}) => {
    const { SchnitzelHuntApp } = await import('../../contracts/build/src/Schnitzel.js');
    state.SchnitzelHuntApp = SchnitzelHuntApp;
  },
  compileContract: async (args: {}) => {
    let  verificationKey: any;
    ({verificationKey} = await state.SchnitzelHuntApp!.compile());
    state.verificationKey = verificationKey;
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  createAccount: async (args: {}) => {
    let ykProofAccountKey = PrivateKey.random();
    let ykProofAccountAddress = ykProofAccountKey.toPublicKey();
    state.privateKey = ykProofAccountKey;
    state.publicKey = ykProofAccountAddress;

  },
  deployApp: async(args: { solution1Root: Field, solution2Root: Field, solution3Root: Field }) =>{
    // const initialBalance = 100_000_000_000;

    let zkapp = new state.SchnitzelHuntApp!(state.publicKey!);
    state.zkapp = zkapp;

    try {
      let tx = await Mina.transaction(state.feePayer!, () => {
        console.log('Funding account');
        AccountUpdate.fundNewAccount(state.feePayer!);
        console.log('Deploying smart contract...');
        if (!state.doProof) {
          zkapp.deploy({ zkappKey: state.privateKey! });
          zkapp.setPermissions({
            ...Permissions.default(),
            editState: Permissions.proofOrSignature(),
          });
        } else {
          zkapp.deploy({ verificationKey: state.verificationKey, zkappKey: state.privateKey! });
        }
      });
      await tx.send().wait();
  
      console.log('Deployment successful!');
    } catch (error) {
      console.error('Error deploying app ' + error);
    }
  
    try {
      let txn = await Mina.transaction(state.feePayer!, () => {
        console.log('Initialising smart contract...');
        zkapp.init(args.solution1Root, args.solution2Root, args.solution3Root);
        if (!state.doProof) zkapp.sign(state.privateKey!);
      });
      if (state.doProof) {
        await txn.prove().then((tx) => {
          tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
        });
      }
      await txn.send().wait();
  
      console.log('Contract successfully deployed and initialized!');
    } catch (error) {
      console.error('Error initialising app ' + error);
    }
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.SchnitzelHuntApp!(publicKey);
  },
  initZkapp: async (args: { }) => {
    state.zkapp = new state.SchnitzelHuntApp!(state.publicKey!);
  },
  getStep: async (args: {}) => {
    const currentStep = await state.zkapp!.step.get();
    return JSON.stringify(currentStep.toJSON());
  },
  getFinished: async (args: {}) => {
    const finished = await state.zkapp!.finished.get();
    return JSON.stringify(finished.toJSON());
  },
  getRoot1: async (args: {}) => {
    const root1 = await state.zkapp!.solution1Root.get();
    return JSON.stringify(root1.toJSON());
  },
  createHuntTransaction: async (args: {locationCheckInstance: LocationCheck, path: MerkleWitness}) => {

    let zkapp = new state.SchnitzelHuntApp!(state.publicKey!);
    state.zkapp = zkapp;

    let sharedLocation: LocationCheck = args.locationCheckInstance;
    console.log('Hunting the schnitzel for location: ', sharedLocation);
    const tx = await Mina.transaction(() => {
        state.zkapp!.hunt(sharedLocation, args.path);
      }
    );
    if (state.doProof) {
      await tx.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
    }
    await tx.send().wait();
    console.log('Yess ! Riddle was solved!');
  },
  createFinishTransaction: async (args: {}) => {
    const tx = await Mina.transaction(() => {
        state.zkapp!.finish();
      }
    );
    if (state.doProof) {
      await tx.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
    }
    await tx.send().wait();
  },
  signUpdateTransaction: async (args: {zkappKey: PrivateKey[]}) => {
    await state.transaction!.sign(args.zkappKey);
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  }
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number,
  fn: WorkerFunctions,
  args: any
}

export type ZkappWorkerReponse = {
  id: number,
  data: any
}
if (process.browser) {
  addEventListener('message', async (event: MessageEvent<ZkappWorkerRequest>) => {
    const returnData = await functions[event.data.fn](event.data.args);

    const message: ZkappWorkerReponse = {
      id: event.data.id,
      data: returnData,
    }
    postMessage(message)
  });
}