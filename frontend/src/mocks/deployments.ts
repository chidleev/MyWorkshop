export interface Deployment {
  id: number;
  order_number: string;
  full_name: string;
  phone: string;
  address: string;
  install_date: string;
  install_time: string;
  status: "Ожидает выезда" | "В пути" | "Монтаж завершен";
  media_files: string[];
}

export const mockDeployments: Deployment[] = [
  {
    id: 101,
    order_number: "MM-2026-021",
    full_name: "Савельева Анна",
    phone: "+7 (916) 456-11-22",
    address: "г. Москва, ул. Академика Янгеля, д. 6, кв. 18",
    install_date: "2026-05-06",
    install_time: "10:00",
    status: "Ожидает выезда",
    media_files: [
      "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1617104551722-3b2d5136644f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    id: 102,
    order_number: "MM-2026-025",
    full_name: "Кузнецов Алексей",
    phone: "+7 (903) 222-33-44",
    address: "г. Королев, пр-т Космонавтов, д. 14",
    install_date: "2026-05-06",
    install_time: "13:30",
    status: "Ожидает выезда",
    media_files: [
      "https://images.unsplash.com/photo-1616594039964-3f8d7dbac3a0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
    ],
  },
];
