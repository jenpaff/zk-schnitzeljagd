import {
  Field,
  isReady,
  Bool,
  Experimental,
  Poseidon,
  Circuit,
  UInt32,
  SelfProof,
  Struct,
  MerkleTree,
  MerkleWitness,
} from 'snarkyjs';
import geohash from 'ngeohash';
/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */

await isReady;

export { MyMerkleWitness, Solution1Tree, Solution2Tree, Solution3Tree };
export { RecSchnitzelHunt, RecSchnitzelHuntState, RecSchnitzelHelper };

const height = 11;
const Solution1Tree = new MerkleTree(height);
const Solution2Tree = new MerkleTree(height);
const Solution3Tree = new MerkleTree(height);
class MyMerkleWitness extends MerkleWitness(height) {}

export class LocationCheck extends Struct({
  sharedGeoHash: Field,
}) {
  static hash(sharedGeoHash: Field): Field {
    return Poseidon.hash(sharedGeoHash.toFields());
  }
}

class RecSchnitzelHuntState extends Struct({
  step: UInt32,
  solution1Root: Field,
  solution2Root: Field,
  solution3Root: Field,
}) {
  static from(state: {
    step: UInt32;
    solution1Root: Field;
    solution2Root: Field;
    solution3Root: Field;
  }): RecSchnitzelHuntState {
    return {
      step: state.step,
      solution1Root: state.solution1Root,
      solution2Root: state.solution2Root,
      solution3Root: state.solution3Root,
    };
  }
}

let RecSchnitzelHunt = Experimental.ZkProgram({
  publicInput: RecSchnitzelHuntState,

  methods: {
    init: {
      // base case
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
      // will be run recursively
      privateInputs: [LocationCheck, MyMerkleWitness, SelfProof],

      method(
        publicInput: RecSchnitzelHuntState,
        sharedLocation: LocationCheck,
        path: MyMerkleWitness,
        previousProof: SelfProof<RecSchnitzelHuntState>
      ) {
        Circuit.log('previousProof: ', previousProof.publicInput);

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

        Circuit.log('step after circuit: ', step);
      },
    },
  },
});

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
  ): MyMerkleWitness {
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
        witness = new MyMerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
        break;
      case '1':
        console.log('attempt to solve step 1');
        idx = solution2Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MyMerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
        break;
      case '2':
        console.log('attempt to solve step 2');
        idx = solution3Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MyMerkleWitness(Solution3Tree.getWitness(BigInt(+idx)));
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

export function convert_location_to_geohash(lat: number, long: number): Field {
  var geoHash: number = geohash.encode_int(lat, long);
  return Field(geoHash);
}
