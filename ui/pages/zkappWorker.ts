import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Permissions,
  Field,
  Poseidon,
} from "snarkyjs";
import geohash from "ngeohash";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import {
  SchnitzelHuntApp,
  LocationCheck,
  MerkleWitness,
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
} from "../../contracts/src/Schnitzel";
import { tic, toc } from "../../contracts/src/tictoc";
import { MerkleTree } from "snarkyjs/dist/node/lib/merkle_tree";

const state = {
  /*
    when turned off it will skip generating a proof for correct solutions, 
    may be used for quick testing of the logic
  */
  doProof: false,
  /*
    when turned off it only adds one geohash solution to the solutionTree (used for quick testing/showcasing) 
    rather than loading the whole solution tree to allow for a wider range of allowed locations per solution
  */
  doQuick: true,
  SchnitzelHuntApp: null as null | typeof SchnitzelHuntApp,
  LocationCheck: null as null | typeof LocationCheck,
  MerkleWitness: null as null | typeof MerkleWitness,
  Solution1Tree: null as null | typeof Solution1Tree,
  Solution2Tree: null as null | typeof Solution2Tree,
  Solution3Tree: null as null | typeof Solution3Tree,
  solution1Map: new Map(),
  solution2Map: new Map(),
  solution3Map: new Map(),
  zkapp: null as null | SchnitzelHuntApp,
  transaction: null as null | Transaction,
  privateKey: null as null | PrivateKey,
  feePayer: null as null | PrivateKey,
  verificationKey: null as any,
  publicKey: null as null | PublicKey,
};

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
    const { SchnitzelHuntApp } = await import(
      "../../contracts/build/src/Schnitzel.js"
    );
    state.SchnitzelHuntApp = SchnitzelHuntApp;

    let { LocationCheck } = await import(
      "../../contracts/build/src/Schnitzel.js"
    );
    state.LocationCheck = LocationCheck;

    let { MerkleWitness } = await import(
      "../../contracts/build/src/Schnitzel.js"
    );
    state.MerkleWitness = MerkleWitness;

    setup_solution_trees();
  },
  compileContract: async (args: {}) => {
    let verificationKey: any;
    ({ verificationKey } = await state.SchnitzelHuntApp!.compile());
    state.verificationKey = verificationKey;
  },
  deployApp: async (args: {}) => {
    let zkapp = new state.SchnitzelHuntApp!(state.publicKey!);
    state.zkapp = zkapp;

    tic("deploy");

    try {
      let tx = await Mina.transaction(state.feePayer!, () => {
        console.log("Funding account");
        AccountUpdate.fundNewAccount(state.feePayer!);
        console.log("Deploying smart contract...");
        if (!state.doProof) {
          zkapp.deploy({ zkappKey: state.privateKey! });
          zkapp.setPermissions({
            ...Permissions.default(),
            editState: Permissions.proofOrSignature(),
          });
        } else {
          zkapp.deploy({
            verificationKey: state.verificationKey,
            zkappKey: state.privateKey!,
          });
        }
      });
      await tx.send().wait();

      console.log("Deployment successful!");
    } catch (error) {
      console.error("Error deploying app " + error);
    }

    toc();

    tic("init");

    try {
      let txn = await Mina.transaction(state.feePayer!, () => {
        console.log("Initialising smart contract...");
        zkapp.init(
          state.Solution1Tree!.getRoot(),
          state.Solution2Tree!.getRoot(),
          state.Solution3Tree!.getRoot()
        );
        if (!state.doProof) zkapp.sign(state.privateKey!);
      });
      if (state.doProof) {
        await txn.prove().then((tx) => {
          tx.forEach((p) =>
            console.log(" \n json proof: " + p?.toJSON().proof)
          );
        });
      }
      await txn.send().wait();

      console.log("Contract successfully deployed and initialized!");
    } catch (error) {
      console.error("Error initialising app " + error);
    }

    toc();
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.SchnitzelHuntApp!(publicKey);
  },
  initZkapp: async (args: {}) => {
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
  getRoot2: async (args: {}) => {
    const root2 = await state.zkapp!.solution2Root.get();
    return JSON.stringify(root2.toJSON());
  },
  getRoot3: async (args: {}) => {
    const root3 = await state.zkapp!.solution3Root.get();
    return JSON.stringify(root3.toJSON());
  },
  createHuntTransaction: async (args: {
    sharedGeoHash: number;
    currentStep: string;
  }) => {
    tic("creating proof for sovling riddle");
    // getting merklepath
    let idx;
    let witness: MerkleWitness;

    switch (args.currentStep) {
      case "0":
        console.log("attempt to solve step 0");
        idx = state.solution1Map.get(args.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log("Location shared is incorrect!");
        }
        witness = new state.MerkleWitness!(
          state.Solution1Tree!.getWitness(BigInt(+idx))
        );
        break;
      case "1":
        console.log("attempt to solve step 1");
        idx = state.solution2Map.get(args.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log("Location shared is incorrect!");
        }
        witness = new state.MerkleWitness!(
          state.Solution2Tree!.getWitness(BigInt(+idx))
        );
        break;
      case "2":
        console.log("attempt to solve step 2");
        idx = state.solution3Map.get(args.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log("Location shared is incorrect!");
        }
        witness = new state.MerkleWitness!(
          state.Solution3Tree!.getWitness(BigInt(+idx))
        );
        break;
      default:
        throw console.log("Invalid step: " + args.currentStep);
    }

    let sharedLocation: LocationCheck = new state.LocationCheck!(
      args.sharedGeoHash
    );

    try {
      let tx = await Mina.transaction(state.feePayer!, () => {
        state.zkapp!.hunt(sharedLocation, witness);
        if (!state.doProof) state.zkapp!.sign(state.privateKey!);
      });
      if (state.doProof) {
        await tx.prove().then((tx) => {
          tx.forEach((p) =>
            console.log(" \n json proof: " + p?.toJSON().proof)
          );
        });
      }
      await tx.send().wait();
    } catch (err) {
      console.log("Solution rejected!");
      console.error("Solution rejected: " + err);
    }
    toc();
  },
  createFinishTransaction: async (args: {}) => {
    tic("finsh game");
    try {
      let tx = await Mina.transaction(state.feePayer!, () => {
        state.zkapp!.finish();
        if (!state.doProof) state.zkapp!.sign(state.privateKey!);
      });
      if (state.doProof) {
        await tx.prove().then((tx) => {
          tx.forEach((p) =>
            console.log(" \n json proof: " + p?.toJSON().proof)
          );
        });
      }
      await tx.send().wait();
    } catch (err) {
      console.log("Solution rejected!");
      console.error("Solution rejected: " + err);
    }
    toc();
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};
if (process.browser) {
  addEventListener(
    "message",
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}

async function setup_solution_trees() {
  tic("build solution merkle trees");
  let { Solution1Tree } = await import(
    "../../contracts/build/src/Schnitzel.js"
  );
  let { Solution2Tree } = await import(
    "../../contracts/build/src/Schnitzel.js"
  );
  let { Solution3Tree } = await import(
    "../../contracts/build/src/Schnitzel.js"
  );

  let solution1Map = new Map();
  let solution2Map = new Map();
  let solution3Map = new Map();

  if (state.doQuick) {
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
  } else {
    solution1Map = generate_solution_tree(
      48.2107356534,
      16.3736139593,
      48.2108048225,
      16.3737322524,
      Solution1Tree
    );
    solution2Map = generate_solution_tree(
      48.2079049216,
      16.3716384673,
      48.2079451583,
      16.3717048444,
      Solution2Tree
    );
    solution3Map = generate_solution_tree(
      48.2086269882,
      16.3725081062,
      48.2086858438,
      16.3725546748,
      Solution3Tree
    );
  }
  state.solution1Map = solution1Map;
  state.Solution1Tree = Solution1Tree;
  state.solution2Map = solution2Map;
  state.Solution2Tree = Solution2Tree;
  state.solution3Map = solution3Map;
  state.Solution3Tree = Solution3Tree;
  toc();
}

export function generate_solution_tree(
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number,
  tree: MerkleTree
): Map<string, number> {
  console.log("generating solution tree...");
  let solutionMap = new Map<string, number>();
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(",");
  for (let index = 0; index < solution.length; index++) {
    let map_index = BigInt(index);
    let hash = Poseidon.hash(Field(+solution[index]).toFields());
    solutionMap.set(solution[index], index);
    tree.setLeaf(map_index, hash);
  }
  console.log("finished merkle tree generation");
  return solutionMap;
}
