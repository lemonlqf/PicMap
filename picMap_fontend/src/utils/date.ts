import moment from "moment";

export function formatDate(time: any, format: string = 'YYYY-MM-DD HH:mm:ss') {
  if (!time) {
    return ''
  }
  return moment(time).format(format)
}

