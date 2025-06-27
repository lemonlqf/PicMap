
import moment from "moment";

export function formatDate(time: number, format: string) {
  return moment(time).format(format)
}

