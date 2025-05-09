import { GithubIcon, InstagramIcon, TwitterIcon } from "lucide-react";
import Link from "next/link";
import { Separator } from "../ui/separator";

const data = [
  {
    label: "LEGAL",
    links: [
      {
        label: "Privacy Policy",
        url: "/privacy",
      },
      {
        label: "Terms & Conditions",
        url: "/terms",
      },
    ],
  },
  {
    label: "RESOURCES",
    links: [
      {
        label: "Blog",
        url: "/blog",
      },
      {
        label: "About",
        url: "/about",
      },
      {
        label: "Contact",
        url: "/contact",
      },
    ],
  },
  {
    label: "SUPPORT",
    links: [
      {
        label: "Telegram",
        url: "/telegram",
      },
      {
        label: "FAQ",
        url: "/faq",
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="w-full">
      <Separator className="my-12" />
      <div className="flex justify-between px-[1.4rem] md:px-[4rem] lg:px-[6rem] xl:px-[8rem] 2xl:px-[12rem]">
        <Links />
      </div>
      <Separator className="mt-8 mb-6" />
      <Socials />
    </footer>
  );
}

function Links() {
  return (
    <div className="text-center justify-evenly grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-6 w-full">
      {data.map(({ label, links }) => (
        <div key={label}>
          <h2 className="mb-3 text-sm uppercase">{label}</h2>
          <ul className="block space-y-1">
            {links.map(({ label, url }) => (
              <li key={label}>
                <Link
                  href={url}
                  className="text-sm transition duration-300 text-muted-foreground hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Socials() {
  return (
    <div className="mb-6 flex justify-center space-x-6 text-muted-foreground">
      <a
        href="https://instagram.com/sesto_dev"
        target="_blank"
        rel="noreferrer"
      >
        <InstagramIcon className="h-4" />
        <span className="sr-only">Instagram page</span>
      </a>
      <a href="https://twitter.com/sesto_dev" target="_blank" rel="noreferrer">
        <TwitterIcon className="h-4" />
        <span className="sr-only">Twitter page</span>
      </a>
      <a href="https://github.com/sesto-dev" target="_blank" rel="noreferrer">
        <GithubIcon className="h-4" />
        <span className="sr-only">GitHub account</span>
      </a>
    </div>
  );
}
