import { Field, Bool } from 'snarkyjs';
import geohash from 'ngeohash';
import { Poseidon } from 'snarkyjs';
import fs from 'fs';

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
    .map((n) => Field(n));

  console.log('targetGeoHash ' + targetGeoHash);
  console.log('sharedGeoHash ' + sharedGeoHash);

  // check if geoHashInt is equal to our incoming geohash or equal one of the neightbours
  let valid = Bool.or(
    targetGeoHash.equals(sharedGeoHash),
    neighbours.filter((n) => sharedGeoHash.equals(n)).length == 1
  );
  return valid;
}

export function write_solution_map_to_file(
  filename: string,
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number
) {
  console.log('writing to file ' + filename);
  // get bounding box geohash integers
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  console.log(solution.length);

  for (let index = 0; index < solution.length; index++) {
    const geoHashInt = +solution[index];
    console.log('index: ' + index + ' geohash: ' + geoHashInt);

    let hash = Poseidon.hash(Field(geoHashInt).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);

    fs.appendFileSync(filename, '\n' + index + ':' + hash);
    fs.appendFileSync(
      filename + '_geohashes.txt',
      '\n' + index + ':' + geoHashInt
    );
  }
}
