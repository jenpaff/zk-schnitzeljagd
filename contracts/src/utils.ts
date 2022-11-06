import { Field, Bool } from 'snarkyjs';
import geohash from 'ngeohash';

/**
 * check if geoHash integer is in one of the neighbours
 */
export function is_in_valid_range(
  targetGeoHash: Field,
  sharedGeoHash: Field
): Bool {
  var geoHashInt: number = +targetGeoHash.toString();
  const neighbours: Field[] = geohash
    .neighbors_int(geoHashInt)
    .map((n) => Field.fromNumber(n));

  console.log('targetGeoHash ' + targetGeoHash);
  console.log('sharedGeoHash ' + sharedGeoHash);

  // check if geoHashInt is equal to our incoming geohash or equal one of the neightbours
  let valid = Bool.or(
    targetGeoHash.equals(sharedGeoHash),
    neighbours.filter((n) => sharedGeoHash.equals(n)).length == 1
  );
  return valid;
}
