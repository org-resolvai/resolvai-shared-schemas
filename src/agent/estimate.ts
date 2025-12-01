import { ActionRecord } from '../shared-types/action-content'

export const estimate = (action: ActionRecord) => {
  return Math.floor(action.importanceRating / 20)
}
