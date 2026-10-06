import lookup from './vendor/tz-lookup.cjs';
export const fallbackTimeZone='Africa/Lagos';
export function locationTimeZone(geo){
  if(!geo || typeof geo.latitude!=='number' || typeof geo.longitude!=='number')return fallbackTimeZone;
  try{const zone=lookup(geo.latitude,geo.longitude);new Intl.DateTimeFormat('en',{timeZone:zone});return zone;}catch{return fallbackTimeZone;}
}
export function entryTimeZone(entry){
  if(entry?.timeZone){try{new Intl.DateTimeFormat('en',{timeZone:entry.timeZone});return entry.timeZone;}catch{}}
  return locationTimeZone(entry?.geo);
}
