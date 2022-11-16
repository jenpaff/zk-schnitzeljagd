import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  isReady,
  CircuitValue,
  prop,
  Bool,
  PrivateKey,
  Mina,
  PublicKey,
  AccountUpdate,
  Experimental,
  Poseidon,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';

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

export { deployApp, MerkleWitness, Tree };
export type { CheckinInterface };

const height = 11;
const Tree = new Experimental.MerkleTree(height);
class MerkleWitness extends Experimental.MerkleWitness(height) {}

export class LocationCheck extends CircuitValue {
  @prop sharedGeoHash: Field;

  constructor(lat: number, long: number) {
    console.log('shared location: ' + lat + ' ' + long);
    super();
    var geoHash: number = geohash.encode_int(lat, long);
    this.sharedGeoHash = Field.fromNumber(geoHash);
    console.log('convert to geoHash: ' + this.sharedGeoHash);
  }

  hash(): Field {
    return Poseidon.hash(this.sharedGeoHash.toFields());
  }
}

export class CheckInApp extends SmartContract {
  @state(Bool) solved = State<Bool>();
  @state(Field) treeRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init(root: Field) {
    this.solved.set(new Bool(false));
    this.treeRoot.set(root);
  }

  @method checkIn(locationCheckInstance: LocationCheck, path: MerkleWitness) {
    // check preconditions
    const isSolved = this.solved.get();
    this.solved.assertEquals(new Bool(false)); // can only check in when I was checked out
    const root = this.treeRoot.get();
    this.treeRoot.assertEquals(root);
    // console.log('shared geohash HASH: '+Poseidon.hash(locationCheckInstance.sharedGeoHash.toFields()));
    path
      .calculateRoot(
        Poseidon.hash(locationCheckInstance.sharedGeoHash.toFields())
      )
      .assertEquals(root);

    const solved = isSolved.not();
    solved.assertEquals(isSolved.not());
    this.solved.set(solved);
  }
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const feePayer = Local.testAccounts[0].privateKey;

type CheckinInterface = {
  // eslint-disable-next-line
  checkIn(
    // eslint-disable-next-line
    sharedLocation: LocationCheck,
    // eslint-disable-next-line
    solution1Map: Map<string, number>
  ): Promise<void>;
  getState(): { solved: boolean };
};

async function deployApp(root: Field) {
  console.log('Deploying Checkin App ....');
  console.log('Merkle root deployApp ' + Tree.getRoot());

  let zkappKey = PrivateKey.random();
  let zkappAddress = zkappKey.toPublicKey();

  tic('compile');
  let { verificationKey } = await CheckInApp.compile();
  toc();

  let zkappInterface = {
    checkIn(sharedLocation: LocationCheck, solution1Map: Map<string, number>) {
      return checkIn(zkappAddress, sharedLocation, solution1Map);
    },
    getState() {
      return getState(zkappAddress);
    },
  };

  let zkapp = new CheckInApp(zkappAddress);

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Funding account...');
      AccountUpdate.fundNewAccount(feePayer);
      console.log('Initialising smart contract...');
      zkapp.init(root);
      zkapp.deploy({ zkappKey, verificationKey });
    });
    await tx.send().wait();

    console.log('Deployment successful!');
  } catch (error) {
    console.error('Error deploying app ' + error);
  }

  return zkappInterface;
}

async function checkIn(
  zkappAddress: PublicKey,
  sharedLocation: LocationCheck,
  solution1Map: Map<string, number>
) {
  console.log('Initiating checkin process...');
  let zkapp = new CheckInApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      let idx = solution1Map.get(sharedLocation.sharedGeoHash.toString());
      if (idx == undefined) {
        throw console.log('Location shared is incorrect!');
      }
      console.log(
        'index: ' + idx + ' geohash: ' + sharedLocation.sharedGeoHash.toString()
      );
      let witness = new MerkleWitness(Tree.getWitness(BigInt(+idx)));
      zkapp.checkIn(sharedLocation, witness);
    });
    tic('prove');
    await txn.prove().then((tx) => {
      tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
    });
    toc();
    await txn.send().wait();
  } catch (err) {
    console.log('Solution rejected!');
    console.error(err);
  }
}

function getState(zkappAddress: PublicKey) {
  let zkapp = new CheckInApp(zkappAddress);
  let solved = zkapp.solved.get().toBoolean();
  // let treeRoot = zkapp.treeRoot.get();
  return { solved };
}
