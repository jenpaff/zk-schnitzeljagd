import { Field, Bool } from 'snarkyjs';
import geohash from 'ngeohash';
import { Poseidon } from 'snarkyjs';
import { Tree } from './CheckIn.js';
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

// 48.2107356534, 16.3736139593, 48.2108048225, 16.3737322524
export function write_solution_map_to_file(
  filename: string,
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number
) {
  console.log('writing to file ' + filename);
  // get bounding box geohash integers
  const solution1 = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  console.log(solution1.length);

  for (let index = 0; index < solution1.length; index++) {
    const geoHashInt = +solution1[index];
    console.log('index: ' + index + ' geohash: ' + geoHashInt);

    let hash = Poseidon.hash(Field.fromNumber(geoHashInt).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);

    fs.appendFileSync(filename, '\n' + index + ':' + hash);
    fs.appendFileSync(
      filename + '_geohashes.txt',
      '\n' + index + ':' + geoHashInt
    );
  }
}

export function read_solution_into_tree_from_file(filename: string) {
  const file = fs.readFileSync(filename, 'utf-8');
  console.log('reading file into Merkletree');
  file.split('\n').forEach((line) => {
    if (line.length > 0) {
      const values = line.split(':');
      console.log(values);
      Tree.setLeaf(BigInt(values[0]), Field.fromString(values[1]));
    }
  });
}

export function read_solution_into_map_from_file(
  filename: string,
  solutionMap: Map<string, number>
): Map<string, number> {
  const file = fs.readFileSync(filename, 'utf-8');
  console.log('reading file into Merkletree');
  file.split('\n').forEach((line) => {
    if (line.length > 0) {
      const values = line.split(':');
      console.log(values);
      solutionMap.set(values[1], +values[0]);
    }
  });
  return solutionMap;
}

export function read_solution_into_map_from_memory(
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number
): Map<string, number> {
  let solutionMap = new Map<string, number>();
  const solution1 = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  console.log('length solution 1 ' + solution1.length);
  for (let index = 0; index < solution1.length; index++) {
    console.log('index: ' + index + ' geohash: ' + solution1[index]);
    let map_index = BigInt(index);
    let hash = Poseidon.hash(Field.fromNumber(+solution1[index]).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);
    solutionMap.set(solution1[index], index);
    Tree.setLeaf(map_index, hash);
  }
  return solutionMap;
}
