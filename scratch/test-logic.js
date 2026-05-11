const Region = {
  NORTH: 'NORTH',
  SOUTH: 'SOUTH',
};
const REGION_LATITUDE_THRESHOLD = 16.5;

function getRegion(latitude) {
  return latitude >= REGION_LATITUDE_THRESHOLD ? Region.NORTH : Region.SOUTH;
}

console.log("16.499999:", getRegion(16.499999));
console.log("16.500001:", getRegion(16.500001));
console.log("90.0:", getRegion(90.0));
