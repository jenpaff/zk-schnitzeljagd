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

export { deployApp };
export type { CheckinInterface };

export class LocationCheck extends CircuitValue {
  @prop sharedGeoHash: Field;

  constructor(lat: number, long: number) {
    console.log('shared location: ' + lat + ' ' + long);
    super();
    var geoHash: number = geohash.encode_int(lat, long);
    this.sharedGeoHash = Field.fromNumber(geoHash);
    console.log('convert to geoHash: ' + this.sharedGeoHash);
  }
}

export class CheckInApp extends SmartContract {
  @state(Field) geoHash = State<Field>();
  @state(Bool) checkedIn = State<Bool>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init() {
    this.geoHash.set(Field.fromNumber(3669811486280996)); // geohash int city center 3669811486280996
    this.checkedIn.set(new Bool(false));
  }

  @method checkIn(locationCheckInstance: LocationCheck) {
    const currGeoHashes = this.geoHash.get();
    this.geoHash.assertEquals(currGeoHashes); // precondition that links this.num.get() to the actual on-chain state
    const currIn = this.checkedIn.get();
    this.checkedIn.assertEquals(new Bool(false)); // can only check in when I was checked out

    // check if incoming geoHash is equal or nearby
    // TODO: causes error 'Can't evaluate prover code outside an as_prover block'
    // let valid = is_in_valid_range(
    //   currGeoHashes,
    //   locationCheckInstance.sharedGeoHash
    // );
    // valid.assertTrue();

    locationCheckInstance.sharedGeoHash.assertEquals(currGeoHashes);

    const checkIn = currIn.not();
    checkIn.assertEquals(currIn.not());
    this.checkedIn.set(checkIn);
  }
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const feePayer = Local.testAccounts[0].privateKey;

type CheckinInterface = {
  // eslint-disable-next-line
  checkIn(sharedLocation: LocationCheck): Promise<void>;
  getState(): { targetGeoHash: string; checkedIn: boolean };
};

async function deployApp() {
  console.log('Deploying Checkin App ....');

  let zkappKey = PrivateKey.random();
  let zkappAddress = zkappKey.toPublicKey();
  tic('compile');
  let { verificationKey } = await CheckInApp.compile();
  toc();

  let zkappInterface = {
    checkIn(sharedLocation: LocationCheck) {
      return checkIn(zkappAddress, sharedLocation);
    },
    getState() {
      return getState(zkappAddress);
    },
  };

  let zkapp = new CheckInApp(zkappAddress);
  let tx = await Mina.transaction(feePayer, () => {
    console.log('Funding account...');
    AccountUpdate.fundNewAccount(feePayer);
    console.log('Initialising smart contract...');
    zkapp.init();
    console.log('Deploying zkapp...');
    zkapp.deploy({ zkappKey, verificationKey });
  });
  await tx.send().wait();

  console.log('Deployment successful!');
  return zkappInterface;
}

async function checkIn(zkappAddress: PublicKey, sharedLocation: LocationCheck) {
  console.log('Initiating checkin process...');
  let zkapp = new CheckInApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      zkapp.checkIn(sharedLocation);
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
  let targetGeoHash = zkapp.geoHash.get().toString();
  let checkedIn = zkapp.checkedIn.get().toBoolean();
  return { targetGeoHash, checkedIn };
}
