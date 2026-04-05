ALTER TABLE "invoice_line_items" ADD COLUMN "company_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "gib_ettn" varchar(36);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;