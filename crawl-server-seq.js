const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = 9000;

const DISTRICT = {
  JUNGGU: [
    "https://www.junggu.seoul.kr",
    "/content.do?cmsid=14232&page=1",
    "중구",
  ],
  JONGROGU: [
    "https://www.jongno.go.kr",
    "/portal/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000271&menuId=1756&menuNo=1756&pageIndex=1",
    "종로구",
  ],
  GANGNAMGU: [
    "https://www.gangnam.go.kr",
    "/notice/list.do?mid=ID05_040201&gubunfield=&deptField=BNI_DEP_CODE&deptId=&keyfield=BNI_MAIN_TITLE&keyword=&pgno=1",
    "강남구",
  ],
};

app.use(cors());

const crawlCheerio = async (url) => {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`[cheerio 에러] ${url}`, error);
    throw error;
  }
};

app.get("/api", async (req, res) => {
  try {
    const crawlDatas = [];
    const crawlFetch = async () =>
      Object.entries(DISTRICT)
        .filter(
          ([key]) =>
            !req.query?.districts ||
            req.query.districts?.split("|").includes(key)
        )
        .reduce(
          (promise, [key, [domain, path, district]]) =>
            promise.then(async () => {
              await crawlByDistrict(
                await crawlCheerio(`${domain}${path}`),
                key,
                district,
                domain,
                req.query?.keywords?.split("|")
              );
            }),
          Promise.resolve()
        );

    const crawlByDistrict = async ($, key, district, domain, keywords) => {
      console.log(`${key} CRAWLING...`);
      console.log("keywords", keywords);

      const promiseAll = (arr) => Promise.all(arr.get());
      switch (key) {
        case "JUNGGU":
          $(".board_list > table > tbody > tr").each((_, el) => {
            const files = [];
            const t = $(el).find(".title > a");
            const h = t.attr("href");
            const [_id, link, title] = [
              `${key}-${h?.split("cid=")[1]}`,
              `${domain}${h}`,
              t.text(),
            ];
            const [startDate, endDate] = $(el)
              .find("td:nth-of-type(3)")
              .text()
              ?.split("~")
              .map((i) => i.trim());

            $(el)
              .find(".file")
              .each((_, f) => {
                files.push({
                  url: `${domain}${$(f).attr("href")}`,
                  name: $(f).attr("title"),
                });
              });

            crawlDatas.push({
              _id,
              district,
              title,
              link,
              startDate,
              endDate,
              files,
            });
          });
          break;

        case "JONGROGU":
          await promiseAll(
            $(".list_type01 > tbody > tr").map(async (_, el) => {
              const files = [];
              const t = $(el).find(".tal > a");
              const nttId = t.attr("href")?.split("'")[1];
              const [_id, link, title, department, startDate, endDate] = [
                `${key}-${nttId}`,
                `${domain}/portal/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000271&menuNo=1756&menuId=1756&nttId=${nttId}`,
                t.text(),
                $(el).find(".division").text(),
                $(el).find(".reg").text(),
                $(el).find(".date1").text().replace("~", ""),
              ];

              const $$ = await crawlCheerio(link);
              $$(".board_view > table > tbody > tr > .first > p > a").each(
                (_, e) => {
                  files.push({
                    url: `${domain}${$$(e).attr("href")}`,
                    name: $$(e).text(),
                  });
                }
              );

              crawlDatas.push({
                _id,
                district,
                title,
                link,
                department,
                startDate,
                endDate,
                files,
              });
            })
          );
          break;

        case "GANGNAMGU":
          await promiseAll(
            $(".table > tbody > tr").map(async (_, el) => {
              const files = [];
              const t = $(el).find(".align-l > a");
              const h = t.attr("href");
              const [_id, link, title, department, startDate] = [
                `${key}-${h?.split("not_ancmt_mgt_no=")[1]?.split("&mid=")[0]}`,
                `${domain}${h}`,
                t.text().trim(),
                $(el).find("td:nth-of-type(4)").text(),
                $(el).find("td:nth-of-type(5)").text(),
              ];

              const $$ = await crawlCheerio(link);
              $$("#fileListCollap a").each((_, e) => {
                files.push({
                  url: $$(e).attr("href"),
                  name: $$(e).find("img").attr("alt"),
                });
              });

              crawlDatas.push({
                _id,
                district,
                title,
                link,
                department,
                startDate,
                files,
              });
            })
          );
          break;
      }
    };

    await crawlFetch();
    res.send(crawlDatas);
  } catch (error) {
    res.status(500).send("CRAWLING ERROR");
  }
});

app.listen(PORT, () => {
  console.log(`크롤링 서버 실행! [PORT:${PORT}]`);
});
