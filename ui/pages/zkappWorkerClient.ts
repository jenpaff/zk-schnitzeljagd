import {
    fetchAccount,
    PublicKey,
    PrivateKey,
    Field,
  } from 'snarkyjs'
  import { LocationCheck, MerkleWitness } from '../../contracts/build/src/Schnitzel.js';
  
  import type { ZkappWorkerRequest, ZkappWorkerReponse, WorkerFunctions } from './zkappWorker';
  
  export default class ZkappWorkerClient {
  
    // ---------------------------------------------------------------------------------------
  
    loadSnarkyJS() {
      return this._call('loadSnarkyJS', {});
    }

    setActiveInstanceToBerkeley() {
      return this._call('setActiveInstanceToBerkeley', {});
    }

    setActiveInstanceToLocal() {
      return this._call('setActiveInstanceToLocal', {});
    }
  
    loadContract() {
      return this._call('loadContract', {});
    }
  
    compileContract(): any {
      return this._call('compileContract', {});
    }
  
    fetchAccount({ publicKey }: { publicKey: PublicKey }): ReturnType<typeof fetchAccount> {
      const result = this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
      return (result as ReturnType<typeof fetchAccount>);
    }
  
    initZkappInstance(publicKey: PublicKey) {
      return this._call('initZkappInstance', {publicKey: publicKey.toBase58()});
    }
  
    async getStep(): Promise<Field> {
      const result = await this._call('getStep', {});
      return Field.fromJSON(JSON.parse(result as string));
    }
  
    deployContract(zkappKey: PrivateKey, zkappAddress: PublicKey) {
      return this._call('deployContract', {zkappKey: zkappKey.toBase58(), zkappAddress: zkappAddress.toBase58()});
    }
    initContract(zkappKey: PrivateKey, solution1Root: Field, solution2Root: Field, solution3Root: Field) {
      return this._call('initContract', {zkappKey: zkappKey.toBase58(), solution1Root, solution2Root, solution3Root});
    }

    createHuntTransaction(locationCheckInstance: LocationCheck, path: MerkleWitness) {
      return this._call('createHuntTransaction', {locationCheckInstance, path});
    }

    createFinishTransaction() {
      return this._call('createFinishTransaction', {});
    }
  
    proveTransaction() {
      return this._call('proveTransaction', {});
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
  