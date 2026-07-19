import { chromium } from 'playwright';
import fs from 'fs/promises';

// Топ-10 вин с метаданными, которые требует твой index.html
const wineList = [
  {
    overallPlace: 1,
    category: 'Vinho do Porto',
    categoryPlace: 'Ruby/Tawny',
    producerRegion: 'Douro',
    enologist: "Taylor's / Kopke",
    searchQuery: 'Porto Tawny',
  },
  {
    overallPlace: 2,
    category: 'Vinho Verde',
    categoryPlace: 'Легкое белое',
    producerRegion: 'Minho',
    enologist: 'Anselmo Mendes',
    searchQuery: 'Vinho Verde branco',
  },
  {
    overallPlace: 3,
    category: 'Touriga Nacional',
    categoryPlace: 'Сухое красное',
    producerRegion: 'Dão',
    enologist: 'Sogrape',
    searchQuery: 'Touriga Nacional tinto',
  },
  {
    overallPlace: 4,
    category: 'Madeira',
    categoryPlace: 'Крепленое',
    producerRegion: 'Madeira',
    enologist: "Justino's",
    searchQuery: 'Madeira doce',
  },
  {
    overallPlace: 5,
    category: 'Douro Tinto',
    categoryPlace: 'Мощное красное',
    producerRegion: 'Douro',
    enologist: 'Barca Velha',
    searchQuery: 'Barca Velha',
  },
  {
    overallPlace: 6,
    category: 'Alentejo Tinto',
    categoryPlace: 'Мягкое красное',
    producerRegion: 'Alentejo',
    enologist: 'Pêra-Manca',
    searchQuery: 'Pera-Manca tinto',
  },
  {
    overallPlace: 7,
    category: 'Dão',
    categoryPlace: 'Элегантное',
    producerRegion: 'Dão',
    enologist: 'Classic Blend',
    searchQuery: 'Dao tinto Reserva',
  },
  {
    overallPlace: 8,
    category: 'Moscatel de Setúbal',
    categoryPlace: 'Десертное',
    producerRegion: 'Setúbal',
    enologist: 'José Maria da Fonseca',
    searchQuery: 'Moscatel de Setubal',
  },
  {
    overallPlace: 9,
    category: 'Baga',
    categoryPlace: 'Танинное',
    producerRegion: 'Bairrada',
    enologist: 'Filipa Pato',
    searchQuery: 'Baga tinto Bairrada',
  },
  {
    overallPlace: 10,
    category: 'Aguardente',
    categoryPlace: 'Бренди',
    producerRegion: 'Portugal',
    enologist: 'Adega Velha',
    searchQuery: 'Aguardente Velha',
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runParser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const results = [];

  for (const wine of wineList) {
    console.log(
      `Ищем категорию [${wine.overallPlace}/10]: ${wine.searchQuery}...`,
    );
    await sleep(2000 + Math.random() * 2000);

    try {
      const searchUrl = `https://www.garrafeiranacional.com/catalogsearch/result/?q=${encodeURIComponent(wine.searchQuery)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });

      try {
        const simButton = page.locator('button:has-text("SIM")');
        if (await simButton.isVisible()) {
          await simButton.click({ force: true });
          await page.waitForTimeout(1000);
        }
      } catch (e) {}

      const firstCard = page.locator('div.slide').first();
      await firstCard
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => null);

      if (await firstCard.isVisible()) {
        const foundName = await firstCard
          .locator('a.product-item-link')
          .innerText()
          .catch(() => wine.searchQuery);
        const buyUrl = await firstCard
          .locator('a.product-item-link')
          .getAttribute('href')
          .catch(() => '#');

        // --- УМНЫЙ СБОР ЦЕНЫ С УЧЕТОМ ТЫСЯЧНЫХ РАЗДЕЛИТЕЛЕЙ ---
        let cleanPrice = 'Н/Д';

        // Шаг 1: Проверяем наличие дата-атрибута с чистой ценой (как на твоем скриншоте)
        const priceWrapper = firstCard.locator('[data-price-amount]').first();
        if ((await priceWrapper.count()) > 0) {
          const amount = await priceWrapper.getAttribute('data-price-amount');
          if (amount) {
            cleanPrice = amount.trim();
          }
        }

        // Шаг 2: Если атрибут не найден, парсим текст регуляркой, устойчивой к пробелам &nbsp; (\u00a0)
        if (cleanPrice === 'Н/Д') {
          const cardText = await firstCard.innerText().catch(() => '');
          // Регулярка теперь захватывает начальную цифру, любые пробелы/неразрывные пробелы посередине, копейки и евро
          const priceMatch =
            cardText.match(/(\d[\d\s\u00a0]*[\.,]\d+)\s*€/) ||
            cardText.match(/€\s*(\d[\d\s\u00a0]*[\.,]\d+)/);

          if (priceMatch) {
            // Удаляем все пробельные символы из получившейся строки
            cleanPrice = priceMatch[1].replace(/[\s\u00a0]/g, '').trim();
          } else {
            // Шаг 3: Крайний случай — вытаскиваем текст из .price напрямую
            const priceElement = firstCard.locator('.price').first();
            if (await priceElement.isVisible()) {
              const rawPrice = await priceElement.innerText();
              cleanPrice = rawPrice.replace(/[€\s\u00a0]/g, '').trim();
            }
          }
        }

        // Парсим картинку
        const imgElement = firstCard.locator('img.product-image-photo');
        let imageUrl =
          (await imgElement.getAttribute('data-src')) ||
          (await imgElement.getAttribute('data-original')) ||
          (await imgElement.getAttribute('src')) ||
          '';

        results.push({
          ...wine,
          name: foundName.trim(),
          price: cleanPrice,
          buyUrl: buyUrl,
          imageUrl: imageUrl.trim(),
        });
        console.log(`  -> Найдено: ${foundName.trim()} по цене €${cleanPrice}`);
      } else {
        results.push({
          ...wine,
          name: wine.searchQuery,
          price: 'Н/Д',
          buyUrl: '#',
          imageUrl: '',
        });
        console.log(`  -> Товар не найден для: ${wine.searchQuery}`);
      }
    } catch (e) {
      console.error(`Ошибка сети при поиске ${wine.searchQuery}: ${e.message}`);
      results.push({
        ...wine,
        name: wine.searchQuery,
        price: 'Ошибка',
        buyUrl: '#',
        imageUrl: '',
      });
    }
  }

  await browser.close();

  await fs.writeFile(
    'wines.json',
    JSON.stringify(
      { updatedAt: new Date().toISOString(), wines: results },
      null,
      2,
    ),
    'utf-8',
  );
  console.log('Готово! Данные успешно обновлены в wines.json.');
}

runParser();
