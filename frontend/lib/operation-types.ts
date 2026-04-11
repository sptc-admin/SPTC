export type OperationDocumentHistoryEntry = {
  url: string
  replacedAt: string
}

export type Operation = {
  id: string
  bodyNumber: string
  mtopDocumentUrl: string
  ltoDocumentUrl: string
  mtopExpirationDate: string
  ltoExpirationDate: string
  mtopDocumentHistory?: OperationDocumentHistoryEntry[] | null
  ltoDocumentHistory?: OperationDocumentHistoryEntry[] | null
  createdAt: string
  updatedAt: string
}
