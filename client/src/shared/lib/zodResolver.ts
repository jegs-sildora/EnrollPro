import { zodResolver as createZodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

export function zodResolver<
  TSchema extends z.ZodType,
  TValues extends FieldValues = Extract<z.output<TSchema>, FieldValues>,
>(schema: TSchema): Resolver<TValues, unknown, TValues> {
  return createZodResolver(schema as never) as Resolver<
    TValues,
    unknown,
    TValues
  >;
}
