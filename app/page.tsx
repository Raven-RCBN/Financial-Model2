import { redirect } from "next/navigation";

export const metadata = {
  title: "Financial Model 2",
  description: "Seeded OPSL plantation financial model test app.",
};

export default function Home() {
  redirect("/fm/index.html");
}
