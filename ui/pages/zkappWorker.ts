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
  } from 'snarkyjs';

  import geohash from 'ngeohash';
  
  type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;
  
  // ---------------------------------------------------------------------------------------
  
  import { LocationCheck, MerkleWitness, SchnitzelHuntApp, Solution1Tree, Solution2Tree, Solution3Tree } from '../../contracts/build/src/Schnitzel.js';
  import { deployApp, SchnitzelInterface } from '../../contracts/build/src/Schnitzel.js';
  
  const state = {
    doProof: false,
    SchnitzelHuntApp: null as null | typeof SchnitzelHuntApp,
    zkappInterface: null as null | SchnitzelInterface,
    zkapp: null as null | SchnitzelHuntApp,
    transaction: null as null | Transaction,
    verificationKey: null as any,
    feePayer: null as any | PrivateKey,
  }
  
  // ---------------------------------------------------------------------------------------
  
  const functions = {
    loadSnarkyJS: async (args: {}) => {
      await isReady;
    },
    setActiveInstanceToLocal: async (args: {}) => {
      let Local = Mina.LocalBlockchain();
      const feePayer = Local.testAccounts[0].privateKey;
      Mina.setActiveInstance(Local);
      state.feePayer = feePayer;
    },
    setActiveInstanceToBerkeley: async (args: {}) => {
      const Berkeley = Mina.BerkeleyQANet(
        "https://proxy.berkeley.minaexplorer.com/graphql"
      );
      Mina.setActiveInstance(Berkeley);
    },
    loadContract: async (args: {}) =>  {
      const { SchnitzelHuntApp } =  await import('../../contracts/build/src/Schnitzel.js'); 
      state.SchnitzelHuntApp = SchnitzelHuntApp;


      // setup solution trees
      let solution1Map = new Map();
      let solution2Map = new Map();
      let solution3Map = new Map();

      // solution 1 
      const test_geohash1 = geohash.encode_int(48.2107958217, 16.3736155926);
      let hash = Poseidon.hash(Field(+test_geohash1).toFields());
      solution1Map.set(test_geohash1.toString(), 0);
      Solution1Tree.setLeaf(BigInt(0), hash);

      // solution 2 
      const test_geohash2 = geohash.encode_int(48.2079410492, 16.3716678382);
      hash = Poseidon.hash(Field(+test_geohash2).toFields());
      solution2Map.set(test_geohash2.toString(), 0);
      Solution2Tree.setLeaf(BigInt(0), hash);

      // solution 3 
      const test_geohash3 = geohash.encode_int(48.2086269882, 16.3725081062);
      hash = Poseidon.hash(Field(+test_geohash3).toFields());
      solution3Map.set(test_geohash3.toString(), 0);
      Solution3Tree.setLeaf(BigInt(0), hash);
    },
    compileContract: async (args: {}) => {
      if (state.doProof) {
        let verificationKey: any;
        ({ verificationKey } = await state.SchnitzelHuntApp!.compile());
        state.verificationKey = verificationKey;
      }
    },
    fetchAccount: async (args: { publicKey58: string }) => {
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      return await fetchAccount({ publicKey });
    },
    deployContract: async (args: { zkappKey: string, zkappAddress: string }) => {

      console.log('zkappKey ', args.zkappKey);
      console.log('zkappAddress ', args.zkappAddress);

      let feePayer = state.feePayer;
      console.log('feePayerAddress ', feePayer.toPublicKey().toBase58());
      let zkappKey = PrivateKey.fromBase58(args.zkappKey);
      let zkappAddress = PublicKey.fromBase58(args.zkappAddress);

      let verificationKey = state.verificationKey;

      state.zkapp = new state.SchnitzelHuntApp!(zkappAddress);

      let tx = await Mina.transaction(feePayer, () => {
        console.log('Funding account');
        AccountUpdate.fundNewAccount(feePayer);
        console.log('done');
        console.log('Deploying smart contract...');
        if (!state.doProof) {
          state.zkapp!.deploy({ zkappKey: zkappKey });
          state.zkapp!.setPermissions({
            ...Permissions.default(),
            editState: Permissions.proofOrSignature(),
          });
        } else {
          state.zkapp!.deploy({ verificationKey: verificationKey, zkappKey: zkappKey });
        }
        console.log('done');
      });
      console.log('prove');
      if (state.doProof) {
        await tx.prove().then((tx) => {
          tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
        });
      }
      console.log('done');
      console.log('send');
      await tx.send().wait();
      console.log('done');
    // state.transaction = tx;
    },
    initContract: async (args: { feePayer: string, zkappKey: string, solution1Root: Field, solution2Root: Field, solution3Root: Field }) => {
      console.log('feePayer ', args.feePayer);
      console.log('zkappKey ', args.zkappKey);

      const feePayer = PrivateKey.fromBase58(args.feePayer);
      let zkappKey = PrivateKey.fromBase58(args.zkappKey);

      let tx = await Mina.transaction(feePayer, () => {
        console.log('Initialising smart contract...');
        state.zkapp!.init(args.solution1Root, args.solution2Root, args.solution3Root);
        if (!state.doProof) state.zkapp!.sign(zkappKey);
      });
      if (state.doProof) {
        await tx.prove().then((tx) => {
          tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
        });
      }
      await tx.send().wait();
    // state.transaction = tx;
    },
    initZkappInstance: async (args: { publicKey: string }) => {
      console.log('initZkappInstance...', args.publicKey);
      const publicKey = PublicKey.fromBase58(args.publicKey);
      state.zkapp = new state.SchnitzelHuntApp!(publicKey);
    },
    getStep: async (args: {}) => {
      console.log('getStep...');
      const currentStep = state.zkapp!.step.get();
      return JSON.stringify(currentStep.toJSON());
    },
    createHuntTransaction: async (args: {locationInstance: LocationCheck, path: MerkleWitness}) => {
      const tx = await Mina.transaction(() => {
          state.zkapp!.hunt(args.locationInstance, args.path);
        }
      );
      if (state.doProof) {
        await tx.prove().then((tx) => {
          tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
        });
      }
      await tx.send().wait();
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
    proveTransaction: async (args: {}) => {
      await state.transaction!.prove();
    },
    getTransactionJSON: async (args: {}) => {
      return state.transaction!.toJSON();
    },
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