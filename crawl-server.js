const express = require("express");
const axios = require("axios");
const { default: axiosRetry } = require("axios-retry");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = 9000;

const DOMAIN_URL = { SEONGNAM: "https://eminwon.seongnam.go.kr/emwp" };

const DISTRICT = {
  JUNGGU: [
    "중구",
    "https://www.junggu.seoul.kr",
    "/content.do?cmsid=14232&page=1",
    "&searchField=all&searchValue=",
  ],
  JONGROGU: [
    "종로구",
    "https://www.jongno.go.kr",
    "/portal/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000271&menuId=1756&menuNo=1756&pageIndex=1",
    "&searchCnd=1&searchWrd=",
  ],
  GANGNAMGU: [
    "강남구",
    "https://www.gangnam.go.kr",
    "/notice/list.do?mid=ID05_040201&pgno=1",
    "&keyfield=BNI_MAIN_CONT&keyword=",
  ],
  YONGSANGU: [
    "용산구",
    "https://www.yongsan.go.kr",
    "/portal/bbs/B0000095/list.do?menuNo=200233",
    "&searchCnd=3&searchWrd=",
  ],
  BUNDANGGU: [
    "분당구",
    "",
    `${DOMAIN_URL.SEONGNAM}/gov/mogaha/ntis/web/ofr/action/OfrAction.do?jndinm=OfrNotAncmtEJB&context=NTIS&subCheck=Y&epcCheck=Y&cgg_code=3810000&method=selectListOfrNotAncmt&methodnm=selectListOfrNotAncmtHomepage`,
    "&Key=B_Content&not_ancmt_cn=",
  ],
};

axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount) => retryCount * 2000,
  retryCondition: (error) => {
    console.log(
      `### ERROR RETRY ATTEMPT[${error?.config?.["axios-retry"]?.retryCount}] ###`,
      error?.config?.url
    );
    return true;
  },
});

app.use(cors());

app.get("/api", async ({ query }, res) => {
  try {
    const [districts, keywords] = [
      query?.districts?.split("|"),
      query?.keywords?.split("|") || [""],
    ];

    const errorUrls = [];
    const results = await Promise.all(
      Object.entries(DISTRICT)
        .filter(([key]) => !districts || districts.includes(key))
        .flatMap(([key, [district, domain, listPath, searchPath]]) =>
          keywords.map((k) => ({
            key,
            district,
            domain,
            crawlUrl: `${domain}${listPath}${k ? `${searchPath}${k}` : ""}`,
          }))
        )
        .map(async ({ key, district, domain, crawlUrl }) => {
          try {
            console.log(`[${key}] "${crawlUrl}" CRAWLING...`);
            const $ = await crawlCheerio(crawlUrl);
            const { crawlDatas, errors } = await crawlByDistrict(
              $,
              key,
              district,
              domain
            );

            if (errors.length > 0) {
              errors.forEach((err) => {
                errorUrls.push(err);
              });
            }

            return crawlDatas;
          } catch (err) {
            console.log("crawl error", err);
            errorUrls.push(crawlUrl);
          }
        })
    );

    const seen = new Set();
    res.send({
      results: results.flat().filter((r) => {
        if (!r || seen.has(r._id)) return false;
        seen.add(r._id);
        return true;
      }),
      errorUrls,
    });
  } catch (error) {
    console.error("Crawling error:", error);
    // res.status(500).send("CRAWLING ERROR");
  }
});

const crawlCheerio = async (url) => {
  try {
    console.log(`- "${url}" CRAWLING...`);
    const { data } = await axios.get(url, { timeout: 100000 });
    return cheerio.load(data);
  } catch (error) {
    console.error(`Cheerio error [URL:${url}]:`, error);
    // throw error;
  }
};

const crawlByDistrict = async ($, key, district, domain) => {
  const [crawlDatas, errors] = [[], []];

  switch (key) {
    case "JUNGGU":
      $(".board_list > table > tbody > tr").each((_, el) => {
        const files = [];
        const t = $(el).find(".title > a");
        const h = t.attr("href");

        const cid = h?.split("cid=")[1];
        if (!cid) return;

        const [link, title] = [`${domain}${h}`, t.text()];
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

        try {
          crawlDatas.push({
            _id: `${key}-${cid}`,
            district,
            title,
            link,
            startDate,
            endDate,
            files,
          });
        } catch (err) {
          console.log(`${key} error`, err);
        }
      });
      break;

    case "JONGROGU":
      await Promise.all(
        $(".list_type01 > tbody > tr").map(async (_, el) => {
          const files = [];
          const t = $(el).find(".tal > a");

          const nttId = t.attr("href")?.split("'")[1];
          if (!nttId) return;

          const [link, title, department, startDate, endDate] = [
            `${domain}/portal/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000271&menuNo=1756&menuId=1756&nttId=${nttId}`,
            t.text(),
            $(el).find(".division").text(),
            $(el).find(".reg").text(),
            $(el).find(".date1").text().replace("~", ""),
          ];

          try {
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
              _id: `${key}-${nttId}`,
              district,
              title,
              link,
              department,
              startDate,
              endDate,
              files,
            });
          } catch (err) {
            errors.push(link);
            console.log(`${key} error`, err);
          }
        })
      );
      break;

    case "GANGNAMGU":
      await Promise.all(
        $(".table > tbody > tr").map(async (_, el) => {
          const files = [];
          const t = $(el).find(".align-l > a");
          const h = t.attr("href");

          const not_ancmt_mgt_no = h
            ?.split("not_ancmt_mgt_no=")[1]
            ?.split("&mid=")[0];
          if (!not_ancmt_mgt_no) return;

          const [link, title, department, startDate] = [
            `${domain}${h}`,
            t.text().trim(),
            $(el).find("td:nth-of-type(4)").text(),
            $(el).find("td:nth-of-type(5)").text(),
          ];

          try {
            const $$ = await crawlCheerio(link);
            $$("#fileListCollap a").each((_, e) => {
              files.push({
                url: $$(e).attr("href"),
                name: $$(e).find("img").attr("alt"),
              });
            });

            crawlDatas.push({
              _id: `${key}-${not_ancmt_mgt_no}`,
              district,
              title,
              link,
              department,
              startDate,
              files,
            });
          } catch (err) {
            errors.push(link);
            console.log(`${key} error`, err);
          }
        })
      );
      break;

    case "YONGSANGU":
      await Promise.all(
        $("#content .bd-list table > tbody > tr").map(async (_, el) => {
          const files = [];
          const t = $(el).find(".title > a");
          const h = t.attr("href");

          const nttId = h?.split("nttId=")[1]?.split("&")[0];
          if (!nttId) return;

          const [link, title, department, startDate] = [
            `${domain}${h}`,
            t.text().trim(),
            $(el).find("td:nth-of-type(5)").text().trim(),
            $(el).find("td:nth-of-type(6)").text().trim(),
          ];

          try {
            const $$ = await crawlCheerio(link);
            $$(".file-list .file").each((_, e) => {
              files.push({
                url: `${domain}${$$(e).attr("href")}`,
                name: $$(e).text().trim(),
              });
            });

            crawlDatas.push({
              _id: `${key}-${nttId}`,
              district,
              title,
              link,
              department,
              startDate,
              files,
            });
          } catch (err) {
            errors.push(link);
            console.log(`${key} error`, err);
          }
        })
      );
      break;

    case "BUNDANGGU":
      await Promise.all(
        $(".tblWrap > table > tbody > tr").map(async (_, el) => {
          const files = [];
          const t = $(el).find(".title > a");

          const not_ancmt_mgt_no = t.attr("onclick")?.split("'")?.[1];
          if (!not_ancmt_mgt_no) return;

          const [link, title, department, startDate, endDate] = [
            `${DOMAIN_URL.SEONGNAM}/gov/mogaha/ntis/web/ofr/action/OfrAction.do?jndinm=OfrNotAncmtEJB&context=NTIS&subCheck=Y&epcCheck=Y&cgg_code=3810000&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=${not_ancmt_mgt_no}`,
            t.text().trim(),
            $(el).find("td:nth-of-type(4)").text().trim(),
            $(el).find("td:nth-of-type(5)").text().trim(),
            $(el).find("td:nth-of-type(6)").text()?.split("~")?.[1]?.trim(),
          ];

          try {
            const $$ = await crawlCheerio(link);
            $$("tr:nth-of-type(4) > .bd01td > a").each((_, e) => {
              const f = $$(e).attr("href")?.split("'");
              if (f?.length > 0) {
                files.push({
                  url: `${DOMAIN_URL.SEONGNAM}/jsp/ofr/FileDown.jsp?user_file_nm=${f[1]}&sys_file_nm=${f[3]}&file_path=${f[5]}`,
                  name: f[1],
                });
              }
            });

            crawlDatas.push({
              _id: `${key}-${not_ancmt_mgt_no}`,
              district,
              title,
              link,
              department,
              startDate,
              endDate,
              files,
            });
          } catch (err) {
            errors.push(link);
            console.log(`${key} error`, err);
          }
        })
      );
      break;
  }

  return { crawlDatas, errors };
};

app.listen(PORT, () => {
  console.log(`CRAWL SERVER START! [PORT:${PORT}]`);
});
