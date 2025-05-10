export type ICreateGroupInfoData = {
  newGroupInfo: {
    newGroupName: string
    newGroupGPSInfo: {
      GPSAltitude: number | null
      GPSLatitude: number | null
      GPSLongitude: number | null
    }
  },
}