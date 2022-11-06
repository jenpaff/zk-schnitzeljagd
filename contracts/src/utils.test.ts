import { LocationCheck } from './CheckIn';
import { isReady, shutdown, Field } from 'snarkyjs';
import { is_in_valid_range } from './utils';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

describe('Utils', () => {
  const currGeoHash = 3669811486280996;

  beforeEach(async () => {
    await isReady;
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  describe('is_in_valid_range', () => {
    it('is_in_valid_range accepts exact location', async () => {
      const locationInstance = new LocationCheck(48.208487, 16.372571);
      expect(
        is_in_valid_range(
          Field.fromNumber(currGeoHash),
          locationInstance.sharedGeoHash
        ).toBoolean()
      ).toEqual(true);
    });
    it('is_in_valid_range accepts location within valid range', async () => {
      const locationInstance = new LocationCheck(48.208487, 16.372572); // move a tiny bit east
      expect(
        is_in_valid_range(
          Field.fromNumber(currGeoHash),
          locationInstance.sharedGeoHash
        ).toBoolean()
      ).toEqual(true);
    });
    it('is_in_valid_range correctly rejects if location is not within valid range', async () => {
      const locationInstance = new LocationCheck(48.208492, 16); // move too far east
      expect(
        is_in_valid_range(
          Field.fromNumber(currGeoHash),
          locationInstance.sharedGeoHash
        ).toBoolean()
      ).toEqual(false);
    });
  });
});
