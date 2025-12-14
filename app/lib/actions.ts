'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import postgres from 'postgres';
import {Invoice} from '@/app/lib/definitions';

const sql = postgres(process.env.POSTGRES_URL!, {ssl: 'require'});

export interface InvoiceFormData {
  customerId: string;
  amount: string; // in cents
  status: Invoice['status'];
}

const InvoiceFormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = InvoiceFormSchema.omit({id: true, date: true});

export async function createInvoice(formData: FormData) {
  const invoiceFormData: InvoiceFormData = {
    customerId: formData.get('customerId') as string,
    amount: formData.get('amount') as string,
    status: formData.get('status') as Invoice['status'],
  };

  const {customerId, amount, status} = CreateInvoice.parse(invoiceFormData);
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database error occurred while creating the invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = InvoiceFormSchema.omit({date: true});

export async function updateInvoice(formData: FormData) {
  const {id, customerId, amount, status} = UpdateInvoice.parse({
    id: formData.get('id'),
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database error occurred while updating the invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const DeleteInvoice = z.object({
  id: z.string(),
});

export async function deleteInvoice(formData: FormData) {
  throw new Error('Failed to delete invoice'); // Temporary error for testing purposes
  const {id} = DeleteInvoice.parse({
    id: formData.get('id'),
  });

  await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `;

  revalidatePath('/dashboard/invoices');
}
