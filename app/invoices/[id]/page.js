"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "../../../components/Sidebar";
import StatusBadge from "../../../components/StatusBadge";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);


  async function fetchInvoice() {
    try {
      const response = await fetch("/api/invoices");
      const data = await response.json();

      const selectedInvoice = data.find(
        (item) => String(item.id) === String(invoiceId)
      );

      setInvoice(selectedInvoice || null);

    } catch (error) {
      console.error(error);
      alert("Error loading invoice.");
    } finally {
      setLoading(false);
    }
  }


  async function updateInvoiceStatus(status) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          status: status,
        }),
      });


      const data = await response.json();


      if (!response.ok) {
        alert(data.error || "Failed updating invoice.");
        return;
      }


      setInvoice({
        ...invoice,
        status: status,
      });


      alert(`Invoice marked as ${status}`);

    } catch (error) {
      console.error(error);
      alert("Error updating invoice.");
    }
  }


  function downloadPDF() {
    window.print();
  }


  if (loading) {
    return (
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <p>Loading invoice...</p>
        </main>
      </div>
    );
  }


  if (!invoice) {
    return (
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">

          <Link href="/invoices" className="backLink">
            ← Back to Invoices
          </Link>

          <h1>Invoice not found</h1>

        </main>
      </div>
    );
  }



  return (

    <div className="appLayout">

      <Sidebar />


      <main className="mainContent">


        <Link href="/invoices" className="backLink noPrint">
          ← Back to Invoices
        </Link>


        <div className="topBar">

          <h1>Invoice Details</h1>


          <div 
            className="noPrint"
            style={{ display: "flex", gap: "12px" }}
          >

            <button
              className="primaryBtn"
              onClick={downloadPDF}
            >
              Download PDF
            </button>


            <button
              className="primaryBtn"
              onClick={() =>
                updateInvoiceStatus("Sent")
              }
            >
              Mark Sent
            </button>


            <button
              className="primaryBtn"
              onClick={() =>
                updateInvoiceStatus("Paid")
              }
            >
              Mark Paid
            </button>


          </div>

        </div>




        <section className="detailsGrid">


          <div className="panel">

            <h3>Client Information</h3>

            <p>
              <strong>Client:</strong>{" "}
              {invoice.client}
            </p>


            <p>
              <strong>Service:</strong>{" "}
              {invoice.service}
            </p>


            <p>
              <strong>Amount:</strong>{" "}
              {invoice.amount}
            </p>


          </div>



          <div className="panel">


            <h3>Invoice Information</h3>


            <p>
              <strong>Invoice No:</strong>{" "}
              {invoice.invoice_number}
            </p>


            <p>
              <strong>Status:</strong>{" "}
              <StatusBadge status={invoice.status} />
            </p>


            <p>
              <strong>Due Date:</strong>{" "}
              {invoice.due_date || "-"}
            </p>


            <p>
              <strong>Created:</strong>{" "}
              {
                invoice.created_at
                  ? new Date(
                      invoice.created_at
                    ).toLocaleDateString("en-GB")
                  : "-"
              }
            </p>


          </div>


        </section>




        <section className="panel">

          <h3>Invoice</h3>


          <pre className="quotePreview">

{`
SAINAL TECHNOLOGIES LTD


INVOICE

Invoice Number: ${invoice.invoice_number}

Client:
${invoice.client}


Service:
${invoice.service}


Total Amount:
${invoice.amount}


Status:
${invoice.status}



Thank you for your business.

`}

          </pre>


        </section>



      </main>


    </div>

  );
}
