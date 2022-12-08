import {
  fetchAccount,
  PublicKey,
  PrivateKey,
  Field,
  CircuitString,
} from 'snarkyjs'
import { LocationCheck, MerkleWitness } from '../../contracts/src/Schnitzel.js';

import type { ZkappWorkerRequest, ZkappWorkerReponse, WorkerFunctions } from './zkappWorker.js';

export default class ZkappWorkerClient {

  // ---------------------------------------------------------------------------------------

  loadSnarkyJS() {
    return this._call('loadSnarkyJS', {});
  }

  async setActiveInstanceToLocal(): Promise<PublicKey>{
    const result = await this._call('setActiveInstanceToLocal', {});
    return result as PublicKey;
  }


  loadContract() {
    return this._call('loadContract', {});
  }

  compileContract() {
    return this._call('compileContract', {});
  }

  fetchAccount({ publicKey }: { publicKey: PublicKey }): ReturnType<typeof fetchAccount> {
    const result = this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
    return (result as ReturnType<typeof fetchAccount>);
  }

  deployApp(solution1Root: Field, solution2Root: Field, solution3Root: Field) {
    return this._call('deployApp', {solution1Root, solution2Root, solution3Root});
  }

  initZkappInstance(publicKey: PublicKey) {
    return this._call('initZkappInstance', { publicKey58: publicKey.toBase58() });
  }

  initZkapp() {
    return this._call('initZkapp', { });
  }

  async getStep(): Promise<Field> {
    const result = await this._call('getStep', {});
    return Field.fromJSON(JSON.parse(result as string))!;
  }
  async getFinished(): Promise<Field> {
    const result = await this._call('getFinished', {});
    return Field.fromJSON(JSON.parse(result as string))!;
  }

  async getRoot1(): Promise<Field> {
    const result = await this._call('getRoot1', {});
    return Field.fromJSON(JSON.parse(result as string))!;
  }

  createHuntTransaction(locationCheckInstance: LocationCheck, path: MerkleWitness) {
    return this._call('createHuntTransaction', {locationCheckInstance, path});
  }

  createFinishTransaction() {
    return this._call('createFinishTransaction', {});
  }


  signUpdateTransaction(zkappKey: PrivateKey[]) {
    return this._call('proveUpdateTransaction', {zkappKey});
  }

  proveUpdateTransaction() {
    return this._call('proveUpdateTransaction', {});
  }

  async getTransactionJSON() {
    const result = await this._call('getTransactionJSON', {});
    return result;
  }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: { [id: number]: { resolve: (res: any) => void, reject: (err: any) => void } };

  nextId: number;

  constructor() {
    this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url))
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject }

      const message: ZkappWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}
