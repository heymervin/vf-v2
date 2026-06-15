/**
 * VenueFlow — PROTOTYPE mock data: Preferred supplier directory.
 *
 * The venue's recommended/approved supplier book — distinct from the
 * per-wedding `Supplier` records in `./index`. Additive.
 */

export interface PreferredSupplier {
  id: string;
  name: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  venueApproved: boolean;
  tags: string[];
  avgRating?: number;
}

export const PREFERRED_SUPPLIERS: PreferredSupplier[] = [
  { id: "ps1", name: "Bloom & Wild Co.", category: "Florist", contactName: "Jess Allen", email: "jess@bloomandwild.co", phone: "+44 7700 902001", website: "https://bloomandwild.co", notes: "Knows the Long Barn intimately — beautiful seasonal arches.", venueApproved: true, tags: ["Florals", "Seasonal"], avgRating: 4.9 },
  { id: "ps2", name: "Aperture Studios", category: "Photographer", contactName: "Dan Pryce", email: "dan@aperturestudios.co.uk", phone: "+44 7700 902002", website: "https://aperturestudios.co.uk", notes: "Documentary style, two shooters, fast turnaround.", venueApproved: true, tags: ["Photo", "Documentary"], avgRating: 4.8 },
  { id: "ps3", name: "Lens & Light", category: "Photographer", contactName: "Amara Obi", email: "hello@lensandlight.co.uk", phone: "+44 7700 902021", website: "https://lensandlight.co.uk", notes: "Editorial and fine-art; also offers film.", venueApproved: true, tags: ["Photo", "Film"], avgRating: 4.7 },
  { id: "ps4", name: "The Vinyl Frontier", category: "Band / DJ", contactName: "Mike Roe", email: "bookings@vinylfrontier.band", phone: "+44 7700 902003", website: "https://vinylfrontier.band", notes: "5-piece function band plus DJ to close.", venueApproved: true, tags: ["Music", "Live"], avgRating: 4.6 },
  { id: "ps5", name: "Sweet Cheeks Cakes", category: "Cake", contactName: "Lara Fenn", email: "lara@sweetcheekscakes.co.uk", phone: "+44 7700 902004", website: "https://sweetcheekscakes.co.uk", notes: "Nut-free kitchen; excellent dietary handling.", venueApproved: true, tags: ["Cake", "Allergen-aware"], avgRating: 4.9 },
  { id: "ps6", name: "Saffron Kitchen", category: "Caterer", contactName: "Yusuf Ali", email: "events@saffronkitchen.co.uk", phone: "+44 7700 902020", website: "https://saffronkitchen.co.uk", notes: "Approved external caterer — halal, South Asian specialities.", venueApproved: true, tags: ["Catering", "Halal", "External"], avgRating: 4.8 },
  { id: "ps7", name: "Lux Coaches", category: "Transport", contactName: "Office", email: "hire@luxcoaches.co.uk", phone: "+44 7700 902005", website: "https://luxcoaches.co.uk", notes: "Reliable evening guest shuttle; 49-seaters.", venueApproved: true, tags: ["Transport"], avgRating: 4.4 },
  { id: "ps8", name: "Candle & Co.", category: "Stylist", contactName: "Beth Sanders", email: "beth@candleandco.co.uk", phone: "+44 7700 902006", website: "https://candleandco.co.uk", notes: "Styling, table dressing and candle hire.", venueApproved: true, tags: ["Styling", "Decor"], avgRating: 4.7 },
  { id: "ps9", name: "Toast Toastmasters", category: "Toastmaster", contactName: "Geoff Pearce", email: "geoff@toasttm.co.uk", phone: "+44 7700 902007", website: "https://toasttm.co.uk", notes: "Calm, experienced MC; great with nervous speakers.", venueApproved: false, tags: ["MC"], avgRating: 4.5 },
  { id: "ps10", name: "Petal & Plume", category: "Florist", contactName: "Niamh Doyle", email: "studio@petalandplume.co.uk", phone: "+44 7700 902008", website: "https://petalandplume.co.uk", notes: "Dramatic installations; higher budget.", venueApproved: false, tags: ["Florals", "Premium"], avgRating: 4.6 },
];
