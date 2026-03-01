"""
Scrape scholarship opportunities from multiple sources.
Saves structured data for content generation.

Usage:
    python3 scrape-scholarships.py
"""

import asyncio
import json
import os
from datetime import datetime

# Try crawl4ai, fallback to basic approach
try:
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
    HAS_CRAWL4AI = True
except ImportError:
    HAS_CRAWL4AI = False
    print("Warning: crawl4ai not available, using basic scraping")

SOURCES = [
    {
        "name": "DAAD",
        "url": "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?status=4&origin=36&subjectGrps=&daession=&q=&page=1&back=1",
        "type": "scholarship",
        "country": "Germany",
    },
    {
        "name": "Chevening",
        "url": "https://www.chevening.org/scholarships/",
        "type": "scholarship",
        "country": "UK",
    },
    {
        "name": "Erasmus Mundus",
        "url": "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
        "type": "scholarship",
        "country": "EU",
    },
    {
        "name": "MEXT Japan",
        "url": "https://www.studyinjapan.go.jp/en/smap-stopj-applications-702.html",
        "type": "scholarship",
        "country": "Japan",
    },
    {
        "name": "Fulbright",
        "url": "https://foreign.fulbrightonline.org/about/foreign-student-program",
        "type": "scholarship",
        "country": "USA",
    },
    {
        "name": "Australia Awards",
        "url": "https://www.dfat.gov.au/people-to-people/australia-awards/australia-awards-scholarships",
        "type": "scholarship",
        "country": "Australia",
    },
    {
        "name": "TokyoDev Jobs",
        "url": "https://www.tokyodev.com/jobs/no-japanese-required",
        "type": "jobs",
        "country": "Japan",
    },
    {
        "name": "GermanTechJobs Visa",
        "url": "https://germantechjobs.de/en/with-visa-sponsorship",
        "type": "jobs",
        "country": "Germany",
    },
    {
        "name": "Relocate.me Germany",
        "url": "https://relocate.me/search/developer/germany",
        "type": "jobs",
        "country": "Germany",
    },
    {
        "name": "WeWorkRemotely",
        "url": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs",
        "type": "jobs",
        "country": "Remote",
    },
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "scraped")


async def scrape_with_crawl4ai(source):
    """Scrape a source using crawl4ai."""
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=50,
    )

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=source["url"], config=config)

        if result.success:
            return {
                "source": source["name"],
                "url": source["url"],
                "type": source["type"],
                "country": source["country"],
                "scraped_at": datetime.now().isoformat(),
                "content_length": len(result.markdown.raw_markdown if result.markdown else ""),
                "content": (result.markdown.raw_markdown if result.markdown else "")[:5000],
                "status": "success",
            }
        else:
            return {
                "source": source["name"],
                "url": source["url"],
                "type": source["type"],
                "country": source["country"],
                "scraped_at": datetime.now().isoformat(),
                "status": "failed",
                "error": str(result.error_message),
            }


async def main():
    os.makedirs(os.path.join(OUTPUT_DIR, "scholarships"), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "opportunities"), exist_ok=True)

    results = []
    print(f"Scraping {len(SOURCES)} sources...\n")

    for source in SOURCES:
        print(f"  → {source['name']} ({source['url'][:60]}...)")
        try:
            if HAS_CRAWL4AI:
                result = await scrape_with_crawl4ai(source)
            else:
                result = {
                    "source": source["name"],
                    "url": source["url"],
                    "type": source["type"],
                    "country": source["country"],
                    "scraped_at": datetime.now().isoformat(),
                    "status": "skipped",
                    "note": "crawl4ai not available",
                }
            results.append(result)
            status = result.get("status", "unknown")
            if status == "success":
                print(f"    ✓ Success ({result.get('content_length', 0)} chars)")
            else:
                print(f"    ✗ {status}: {result.get('error', result.get('note', ''))}")
        except Exception as e:
            print(f"    ✗ Error: {str(e)[:100]}")
            results.append({
                "source": source["name"],
                "url": source["url"],
                "type": source["type"],
                "country": source["country"],
                "scraped_at": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)[:200],
            })

    # Save results
    output_path = os.path.join(OUTPUT_DIR, "scrape-results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✓ Results saved to {output_path}")

    # Summary
    success = sum(1 for r in results if r["status"] == "success")
    print(f"\nSummary: {success}/{len(results)} sources scraped successfully")


if __name__ == "__main__":
    asyncio.run(main())
