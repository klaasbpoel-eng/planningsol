import { Link } from "react-router-dom";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground print:hidden">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
              SOL Nederland
            </h3>
            <p className="text-sm text-primary-foreground/80 max-w-xs">
              De betrouwbare partner voor technische, medische en speciale gassen.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Snelle Links</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <a 
                  href="https://solnederland.solgroup.com/nl/over-ons" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Over Ons
                </a>
              </li>
              <li>
                <a 
                  href="https://solnederland.solgroup.com/nl/sol-for-industry" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Industrie
                </a>
              </li>
              <li>
                <a 
                  href="https://solnederland.solgroup.com/nl/sol-for-healthcare" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Gezondheidszorg
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Contact</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>Swaardvenstraat 11</li>
              <li>5048 AV Tilburg</li>
              <li>Nederland</li>
              <li className="pt-2">
                <a href="tel:+31134551333" className="hover:text-white transition-colors">
                  +31 13 455 1333
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Sol Group */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Sol Group</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <a 
                  href="https://www.solgroup.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Corporate Website
                </a>
              </li>
              <li>
                <a 
                  href="https://www.solgroup.com/en/investor-relation" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Investor Relations
                </a>
              </li>
              <li>
                <a 
                  href="https://www.solgroup.com/en/sustainability" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Duurzaamheid
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/60">
          <p>&copy; {currentYear} Sol Nederland B.V. Alle rechten voorbehouden.</p>
        </div>
      </div>
    </footer>
  );
}
