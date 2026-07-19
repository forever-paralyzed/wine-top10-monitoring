import { chromium } from 'playwright';

async function getPrice(wineName) {
  const browser = await chromium.launch({ headless: true }); // headless: true — браузер не будет открываться на экране
  const page = await browser.newPage();

  // Пример запроса к поиску сайта (используем Garrafeira Nacional)
  const searchUrl = `https://www.garrafeiranacional.com/catalogsearch/result/?q=${encodeURIComponent(wineName)}`;

  await page.goto(searchUrl);

  // Ждем, пока прогрузится список товаров
  try {
    // Ждем элемент, где обычно лежит цена
    const priceElement = await page.locator('.price').first();
    const linkElement = await page.locator('.product-item-link').first();

    const price = await priceElement.textContent();
    const link = await linkElement.getAttribute('href');

    console.log(`Найдено: ${wineName} -> Цена: ${price}, Ссылка: ${link}`);
    return { price: price.trim(), url: link };
  } catch (e) {
    console.log(`Товар ${wineName} не найден или отсутствует цена.`);
    return { price: 'N/A', url: '#' };
  } finally {
    await browser.close();
  }
}

// Тест для одного вина
getPrice('Pintas');
