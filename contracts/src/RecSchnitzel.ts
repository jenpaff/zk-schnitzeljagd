import {
  Field,
  SmartContract,
  state,
  State,
  method,
  isReady,
  CircuitValue,
  prop,
  Bool,
  Experimental,
  Poseidon,
  Circuit,
  UInt32,
  Proof,
  SelfProof,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { MerkleTree } from 'snarkyjs/dist/node/lib/merkle_tree.js';
/**
 * Inspired by https://docs.minaprotocol.com/zkapps
 *
 * The RecSchnitzel is a recursive version of the Schnitzel contract. The recursive contract
 * allows us to recursively proof a proof within a proof and then submit the final version on-chain.
 * On initialization it requires the Merkleroot of the solution trees, one solution tree per riddle presented.
 *
 * When the hunt method is called, the contract will verify whether the passed location is indeed
 * a valid solution by evaluating the merkle proof and increase the step count by one if successful.
 *
 * When the finish method is called, we check whether all steps have been completed
 * and set finish to true if successful.
 */

await isReady;

export { MerkleWitness, Solution1Tree, Solution2Tree, Solution3Tree };
export {
  RecSchnitzelApp,
  RecSchnitzelHuntState,
  RecSchnitzelHelper,
  RecSchnitzelRollup,
};

const height = 11;
const Solution1Tree = new Experimental.MerkleTree(height);
const Solution2Tree = new Experimental.MerkleTree(height);
const Solution3Tree = new Experimental.MerkleTree(height);
class MerkleWitness extends Experimental.MerkleWitness(height) {}

export class LocationCheck extends CircuitValue {
  @prop sharedGeoHash: Field;

  constructor(lat: number, long: number) {
    super();
    var geoHash: number = geohash.encode_int(lat, long);
    this.sharedGeoHash = Field(geoHash);
    console.log(
      'geoHash hash: ' + Poseidon.hash(this.sharedGeoHash.toFields())
    );
  }

  hash(): Field {
    return Poseidon.hash(this.sharedGeoHash.toFields());
  }
}

class RecSchnitzelHuntState extends CircuitValue {
  @prop step: UInt32;
  @prop solution1Root: Field;
  @prop solution2Root: Field;
  @prop solution3Root: Field;

  constructor(
    step: UInt32,
    solution1Root: Field,
    solution2Root: Field,
    solution3Root: Field
  ) {
    super();
    this.step = step;
    this.solution1Root = solution1Root;
    this.solution2Root = solution2Root;
    this.solution3Root = solution3Root;
  }

  // helper
  static from(state: {
    step: UInt32;
    solution1Root: Field;
    solution2Root: Field;
    solution3Root: Field;
  }) {
    return new this(
      state.step,
      state.solution1Root,
      state.solution2Root,
      state.solution3Root
    );
  }
}

let RecSchnitzelApp = Experimental.ZkProgram({
  publicInput: RecSchnitzelHuntState,

  methods: {
    init: {
      privateInputs: [],

      method(publicInput: RecSchnitzelHuntState) {
        // check that values are correctly initialised
        publicInput.step.assertEquals(UInt32.zero);
        const solution1Root = publicInput.solution1Root;
        publicInput.solution1Root.assertEquals(solution1Root);

        const solution2Root = publicInput.solution2Root;
        publicInput.solution2Root.assertEquals(solution2Root);

        const solution3Root = publicInput.solution3Root;
        publicInput.solution3Root.assertEquals(solution3Root);
      },
    },
    hunt: {
      privateInputs: [LocationCheck, MerkleWitness, SelfProof],

      method(
        publicInput: RecSchnitzelHuntState,
        sharedLocation: LocationCheck,
        path: MerkleWitness,
        previousProof: SelfProof<RecSchnitzelHuntState>
      ) {
        previousProof.verify();

        let step = previousProof.publicInput.step;
        step = step.add(UInt32.one);
        publicInput.step.assertEquals(step);

        const solution1Root = publicInput.solution1Root;
        publicInput.solution1Root.assertEquals(solution1Root);

        const solution2Root = publicInput.solution2Root;
        publicInput.solution2Root.assertEquals(solution2Root);

        const solution3Root = publicInput.solution3Root;
        publicInput.solution3Root.assertEquals(solution3Root);

        const isFirstStep: Bool = step.equals(UInt32.one);
        const isSecondStep: Bool = step.equals(UInt32.from(2));
        const isThirdStep: Bool = step.equals(UInt32.from(3));

        const root_to_check = Circuit.switch(
          [isFirstStep, isSecondStep, isThirdStep],
          Field,
          [solution1Root, solution2Root, solution3Root]
        );

        path
          .calculateRoot(Poseidon.hash(sharedLocation.sharedGeoHash.toFields()))
          .assertEquals(root_to_check);
      },
    },
  },
});

class RecSchnitzelProof extends Proof<RecSchnitzelHuntState> {
  static publicInputType = RecSchnitzelHuntState;
  static tag = () => RecSchnitzelApp;
}

class RecSchnitzelRollup extends SmartContract {
  @state(Bool) finished = State<Bool>();

  @method finish(
    proof: RecSchnitzelProof // <-- we're passing in a proof!
  ) {
    // verify the proof
    proof.verify();

    // assert that user completed all steps
    proof.publicInput.step.assertEquals(UInt32.from(3));

    // declare that someone won this game!
    this.finished.set(Bool(true));
  }
}

let RecSchnitzelHelper = {
  init(solution1Root: Field, solution2Root: Field, solution3Root: Field) {
    return RecSchnitzelHuntState.from({
      step: UInt32.zero,
      solution1Root,
      solution2Root,
      solution3Root,
    });
  },

  generateMerkleProof(
    sharedLocation: LocationCheck,
    solution1Map: Map<string, number>,
    solution2Map: Map<string, number>,
    solution3Map: Map<string, number>,
    previousProof: SelfProof<RecSchnitzelHuntState>
  ): MerkleWitness {
    // TOFIX: got a weird error when i couldn't match UInt32 in my switch case
    // cos this function would then returned an undefined witness
    // returns an OCaml error
    let step = previousProof.publicInput.step.toString();
    let idx;
    let witness;

    switch (step) {
      case '0':
        console.log('attempt to solve step 0');
        idx = solution1Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
        break;
      case '1':
        console.log('attempt to solve step 1');
        idx = solution2Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
        break;
      case '2':
        console.log('attempt to solve step 2');
        idx = solution3Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution3Tree.getWitness(BigInt(+idx)));
        break;
      default:
        throw console.log('Invalid step: ' + step);
    }
    if (step == undefined || witness == undefined) {
      throw console.log(
        'Step invalid: ' + step + ' - Witness invalid: ' + witness
      );
    }

    return witness;
  },

  hunt(previousProof: SelfProof<RecSchnitzelHuntState>) {
    return RecSchnitzelHuntState.from({
      ...previousProof.publicInput,
      step: previousProof.publicInput.step.add(UInt32.one),
    });
  },
};

export function generate_solution_tree(
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number,
  tree: MerkleTree
): Map<string, number> {
  let solutionMap = new Map<string, number>();
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  for (let index = 0; index < solution.length; index++) {
    let map_index = BigInt(index);
    let hash = Poseidon.hash(Field(+solution[index]).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);
    solutionMap.set(solution[index], index);
    tree.setLeaf(map_index, hash);
  }
  return solutionMap;
}
