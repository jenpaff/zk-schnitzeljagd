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
  @state(Field) counter = State<Field>();

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
    this.counter.set(Field(0));
  }

  @method checkIn(locationCheckInstance: LocationCheck, path: MerkleWitness) {
    // check preconditions
    const isSolved = this.solved.get();
    this.solved.assertEquals(new Bool(false)); // can only check in when I was checked out
    const root = this.treeRoot.get();
    this.treeRoot.assertEquals(root);
    const counter = this.counter.get();
    this.counter.assertEquals(counter);
    this.counter.set(counter.add(Field(1)));
    path
      .calculateRoot(
        Poseidon.hash(locationCheckInstance.sharedGeoHash.toFields())
      )
      .assertEquals(root);

    const solved = isSolved.not();
    solved.assertEquals(isSolved.not());
    this.solved.set(solved);
  }

  @method update(update_to: Bool) {
    const counter = this.counter.get();
    this.counter.assertEquals(counter);
    this.counter.set(counter.add(Field(1)));
    const isSolved = this.solved.get();
    this.solved.assertEquals(isSolved);
    this.solved.set(update_to);
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
  update(): Promise<void>;
};

async function deployApp(root: Field, doProof: boolean) {
  console.log('Deploying Checkin App ....');
  console.log('Merkle root deployApp ' + Tree.getRoot());

  let zkappPrivateKey = PrivateKey.random();
  let zkappAddress = zkappPrivateKey.toPublicKey();

  let verificationKey: any;

  if (doProof) {
    tic('compile');
    ({ verificationKey } = await CheckInApp.compile());
    toc();
  }

  let zkappInterface = {
    checkIn(sharedLocation: LocationCheck, solution1Map: Map<string, number>) {
      return checkIn(
        zkappPrivateKey,
        zkappAddress,
        sharedLocation,
        solution1Map,
        doProof
      );
    },
    getState() {
      return getState(zkappAddress);
    },
    update(bla: Bool) {
      return update(zkappPrivateKey, zkappAddress, doProof, bla);
    },
  };

  let zkapp = new CheckInApp(zkappAddress);

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Funding account...');
      AccountUpdate.fundNewAccount(feePayer);
      console.log('Deploying smart contract...');
      zkapp.deploy({ zkappKey: zkappPrivateKey, verificationKey });
      if (!doProof) {
        zkapp.setPermissions({
          ...Permissions.default(),
          editState: Permissions.proofOrSignature(),
        });
      }
    });
    await tx.send().wait();

    console.log('Deployment successful!');
  } catch (error) {
    console.error('Error deploying app ' + error);
  }

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Initialising smart contract...');
      zkapp.init(root);
      if (!doProof) zkapp.sign(zkappPrivateKey);
    });
    if (doProof) {
      console.log('proving...');
      await tx.prove();
    }
    await tx.send().wait();

    console.log('Contract successfully deployed and initialized!');
  } catch (error) {
    console.error('Error initialising app ' + error);
  }

  return zkappInterface;
}

async function checkIn(
  zkappPrivateKey: PrivateKey,
  zkappAddress: PublicKey,
  sharedLocation: LocationCheck,
  solution1Map: Map<string, number>,
  doProof: boolean
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
      if (!doProof) {
        zkapp.sign(zkappPrivateKey);
      }
    });
    if (doProof) {
      tic('prove');
      await txn.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
      toc();
    }
    await txn.send().wait();
  } catch (err) {
    console.log('Solution rejected!');
    console.error(err);
  }
}

async function update(
  zkappPrivateKey: PrivateKey,
  zkappAddress: PublicKey,
  doProof: boolean,
  update_to: Bool
) {
  console.log('Initiating update process...');
  let zkapp = new CheckInApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      zkapp.update(update_to);
      if (!doProof) {
        zkapp.sign(zkappPrivateKey);
      }
    });
    if (doProof) {
      tic('prove');
      await txn.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
      toc();
    }
    await txn.send().wait();
  } catch (err) {
    console.log('Solution rejected!');
    console.error(err);
  }
}

function getState(zkappAddress: PublicKey) {
  let zkapp = new CheckInApp(zkappAddress);
  let solved = zkapp.solved.get().toBoolean();
  let counter = zkapp.counter.get().toString();
  return { solved, counter };
}
