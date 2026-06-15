import { primaryWedding } from "@/lib/mock"
import { PREFERRED_SUPPLIERS } from "@/lib/mock"
import { SuppliersClient } from "./suppliers-client"

export const metadata = { title: "Suppliers" }

/**
 * Suppliers page — server shell.
 * Loads mock data and passes it to the interactive client component.
 * All filter/expand/tab state lives in SuppliersClient.
 */
export default function SuppliersPage() {
  const wedding = primaryWedding()

  return (
    <SuppliersClient
      suppliers={wedding.suppliers}
      docs={wedding.docs}
      coupleName={wedding.coupleName}
      preferredSuppliers={PREFERRED_SUPPLIERS}
    />
  )
}
