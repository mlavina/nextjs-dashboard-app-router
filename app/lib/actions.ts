'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import postgres from 'postgres';
import {Invoice} from '@/app/lib/definitions';
import {signIn} from '@/auth';
import {AuthError} from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, {ssl: 'require'});

export interface InvoiceFormData {
  customerId: string;
  amount: string; // in cents
  status: Invoice['status'];
}

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const InvoiceFormSchema = z.object({
  id: z.string(),
  customerId: z.string({invalid_type_error: 'Please select a customer.'}),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select a valid status.',
  }),
  date: z.string(),
});

const CreateInvoice = InvoiceFormSchema.omit({id: true, date: true});

export async function createInvoice(prevState: State, formData: FormData) {
  const invoiceFormData: InvoiceFormData = {
    customerId: formData.get('customerId') as string,
    amount: formData.get('amount') as string,
    status: formData.get('status') as Invoice['status'],
  };

  const validatedFields = CreateInvoice.safeParse(invoiceFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to create invoice.',
    };
  }

  const {customerId, amount, status} = validatedFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    console.error('Database Error:', error);
    throw error;
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = InvoiceFormSchema.omit({date: true});

export async function updateInvoice(prevState: State, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    id: formData.get('id'),
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  console.log('Validated Fields:', validatedFields);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to update invoice.',
    };
  }

  const {id, customerId, amount, status} = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw error;
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const DeleteInvoice = z.object({
  id: z.string(),
});

export async function deleteInvoice(formData: FormData) {
  try {
    const {id} = DeleteInvoice.parse({
      id: formData.get('id'),
    });

    await sql`
      DELETE FROM invoices
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw error;
  }

  revalidatePath('/dashboard/invoices');
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
