'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Facebook,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Truck,
  BadgeCheck,
} from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#0F48A2] text-white border-t border-white/10">
      {/* Top trust bar */}
      <div className="border-b border-white/10">
        {/* ✅ CHANGED: wider container + better side padding */}
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TrustItem
              icon={<Truck className="h-5 w-5" />}
              title="Fast Delivery"
              desc="Inside Dhaka & Nationwide"
            />
            <TrustItem
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Secure Checkout"
              desc="Safe payments & privacy"
            />
            <TrustItem
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Quality Assured"
              desc="Checked products & support"
            />
          </div>
        </div>
      </div>

      {/* Main footer */}
      {/* ✅ CHANGED: wider container + better side padding */}
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
          {/* Brand */}
          <div className="md:col-span-4 space-y-4">
            {/* Footer logo (single mark + wordmark) */}
            <Link href="/" className="inline-flex items-center group">
              <Image
                src="/footer_white.png"
                alt="Spraxe"
                width={520}
                height={140}
                priority
                className="h-12 sm:h-14 md:h-16 w-auto"
              />
            </Link>

            <p className="text-sm leading-relaxed text-white/80 max-w-sm">
              Bangladesh’s modern e-commerce store for quality products at fair prices — with reliable delivery and
              real support.
            </p>

            {/* Newsletter (optional, no backend) */}
            <div className="pt-2">
              <div className="text-xs font-semibold text-white/90 mb-2">Get updates</div>
              <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50
                             outline-none focus:border-white/40 focus:ring-2 focus:ring-white/30"
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-white text-[#0F48A2] text-sm font-bold hover:bg-white/90 transition inline-flex items-center gap-2"
                >
                  Subscribe <ArrowRight className="h-4 w-4" />
                </button>
              </form>
              <div className="text-xs text-white/60 mt-2">No spam. Unsubscribe anytime.</div>
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-2">
            <FooterHeading>Shop</FooterHeading>
            <ul className="space-y-2 text-sm">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/products">Products</FooterLink>
              <FooterLink href="/categories">Categories</FooterLink>
              <FooterLink href="/featured">Featured</FooterLink>
              <FooterLink href="/compare">Compare</FooterLink>
              <FooterLink href="/apple-accessories">Apple Accessories</FooterLink>
              <FooterLink href="/usb-c-hubs-for-macbook">USB-C Hubs for MacBook</FooterLink>
              <FooterLink href="/thunderbolt-docks">Thunderbolt Docks</FooterLink>
            </ul>
          </div>

          <div className="md:col-span-3">
            <FooterHeading>Support</FooterHeading>
            <ul className="space-y-2 text-sm">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/support">Support Desk</FooterLink>
              <FooterLink href="/track-order">Track Order</FooterLink>
              <FooterLink href="/faq">FAQ</FooterLink>
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/terms">Terms & Conditions</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/returns">Returns & Refunds</FooterLink>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <FooterHeading>Contact</FooterHeading>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/70" />
                <a href="mailto:spraxecare@gmail.com" className="hover:text-white transition text-white/80">
                  spraxecare@gmail.com
                </a>
              </li>

              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/70" />
                <a href="tel:+8809638371951" className="hover:text-white transition text-white/80">
                  09638371951
                </a>
              </li>

              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/70" />
                <span className="text-white/80">Vatara, Dhaka, Bangladesh</span>
              </li>
            </ul>

            {/* Socials */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-white/90 mb-2">Follow</div>
              <div className="flex items-center gap-2">
                <SocialIcon href="https://facebook.com" label="Facebook" icon={<Facebook className="h-4 w-4" />} />
                <SocialIcon href="https://instagram.com" label="Instagram" icon={<Instagram className="h-4 w-4" />} />
                <SocialIcon href="https://youtube.com" label="YouTube" icon={<Youtube className="h-4 w-4" />} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-xs text-white/60">
            &copy; {new Date().getFullYear()} Spraxe. All rights reserved.{' '}
            <span className="text-white/60">
              Developed and Managed by{' '}
              <a
                href="https://www.facebook.com/hridoy.hossen.roni.2025"
                target="_blank"
                rel="noreferrer"
                className="text-white/80 hover:text-white transition"
              >
                Roni
              </a>
              .
            </span>
          </p>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-white/60 hover:text-white transition">
              Terms
            </Link>
            <Link href="/privacy" className="text-white/60 hover:text-white transition">
              Privacy
            </Link>
            <Link href="/support" className="text-white/60 hover:text-white transition">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-extrabold mb-4 tracking-tight">{children}</h3>;
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-white/80 hover:text-white transition">
        {children}
      </Link>
    </li>
  );
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 inline-flex items-center justify-center
                 text-white hover:text-white hover:border-white/40 hover:bg-white/20 transition"
    >
      {icon}
    </a>
  );
}

function TrustItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-sm font-extrabold text-white">{title}</div>
        <div className="text-xs text-white/70 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
