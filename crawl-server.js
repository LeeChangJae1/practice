const express = require("express");
const axios = require("axios");
const { default: axiosRetry } = require("axios-retry");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = 9000;

const DISTRICT = {
  JUNGGU: {
    NAME: "중구",
    URL: [
      "https://www.junggu.seoul.kr",
      "/content.do?cmsid=14232",
      "&searchField=all&searchValue=",
    ],
  },
  JONGROGU: {
    NAME: "종로구",
    URL: [
      "https://www.jongno.go.kr",
      "/portal/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000271&menuId=1756&menuNo=1756",
      "&searchCnd=1&searchWrd=",
    ],
  },
  GANGNAMGU: {
    NAME: "강남구",
    URL: [
      "https://www.gangnam.go.kr",
      "/notice/list.do?mid=ID05_040201",
      "&keyfield=BNI_MAIN_CONT&keyword=",
    ],
  },
  YONGSANGU: {
    NAME: "용산구",
    URL: [
      "https://www.yongsan.go.kr",
      "/portal/bbs/B0000095/list.do?menuNo=200233",
      "&searchCnd=3&searchWrd=",
    ],
  },
  YEONGDEUNGPOGU: {
    NAME: "영등포구",
    URL: [
      "https://www.ydp.go.kr",
      "/www/selectEminwonList.do?key=2851&menuFlag=01",
      "&searchCnd=B_Content&searchKrwd=",
    ],
  },
  BUNDANGGU: { NAME: "분당구" },
  SEOCHOGU: { NAME: "서초구" },
};

const CREAT_EMINWON_DOMAIN = (n) => `https://eminwon.${n}.go.kr`;
const EMINWON_NOTICE_URL =
  "/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?jndinm=OfrNotAncmtEJB&context=NTIS&subCheck=Y&epcCheck=Y";
const EMINWON = {
  URL: {
    LIST: `${EMINWON_NOTICE_URL}&method=selectListOfrNotAncmt&methodnm=selectListOfrNotAncmtHomepage&ofr_pageSize=30`,
    CGG_CODE: "&cgg_code=",
    SEARCH: "&Key=B_Content&not_ancmt_cn=",
    VIEW: `${EMINWON_NOTICE_URL}&method=selectOfrNotAncmt&methodnm=selectOfrNotAncmtRegst&not_ancmt_mgt_no=`,
    FILE: "/emwp/jsp/ofr/FileDown.jsp",
  },
  DISTRICT: {
    BUNDANGGU: ["seongnam", 3810000],
    SEOCHOGU: ["seocho"],
  },
};

axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount) => retryCount * 2000,
  retryCondition: (error) => {
    const retryCount = error?.config?.["axios-retry"]?.retryCount;
    if (typeof retryCount === "number") {
      console.log(
        `### ERROR RETRY ATTEMPT[${retryCount + 1}] ###`,
        error?.config?.url
      );
    }
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
        .filter(([KEY]) => !districts || districts.includes(KEY))
        .flatMap(([KEY, v]) => {
          const [eminDomainName, eminCggCode] = EMINWON.DISTRICT[KEY] || [
            "",
            "",
          ];
          const eminCggQueryParamUrl = eminCggCode
            ? `${EMINWON.URL.CGG_CODE}${eminCggCode}`
            : "";

          const [domain, listPath, searchPath] =
            v?.URL ||
            (eminDomainName
              ? [
                  CREAT_EMINWON_DOMAIN(eminDomainName),
                  `${EMINWON.URL.LIST}${eminCggQueryParamUrl}`,
                  EMINWON.URL.SEARCH,
                ]
              : ["", "", ""]);

          return keywords.map((k) => ({
            KEY,
            districtName: v.NAME,
            domain,
            crawlUrl: `${domain}${listPath}${k ? `${searchPath}${k}` : ""}`,
            eminCggQueryParamUrl,
          }));
        })
        .map(
          async ({
            KEY,
            districtName,
            domain,
            crawlUrl,
            eminCggQueryParamUrl,
          }) => {
            try {
              console.log(`[${KEY}] "${crawlUrl}" CRAWLING...`);
              const $ = await crawlCheerio(crawlUrl);
              const { crawlDatas, errors } = await crawlByDistrict(
                $,
                KEY,
                districtName,
                domain,
                eminCggQueryParamUrl
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
          }
        )
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
  }
});

const crawlCheerio = async (url) => {
  try {
    console.log(`- "${url}" CRAWLING...`);
    const { data } = await axios.get(url, { timeout: 100000 });
    return cheerio.load(data);
  } catch (error) {
    console.error(`Cheerio error [URL:${url}]:`, error);
  }
};

const crawlByDistrict = async (
  $,
  key,
  districtName,
  domain,
  eminCggQueryParamUrl
) => {
  let [crawlDatas, errors, eminTableCheerioSelector] = [[], [], ""];

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
            districtName,
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
            if (typeof $$ !== "function") return;

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
              districtName,
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
            if (typeof $$ !== "function") return;

            $$("#fileListCollap a").each((_, e) => {
              files.push({
                url: $$(e).attr("href"),
                name: $$(e).find("img").attr("alt"),
              });
            });

            crawlDatas.push({
              _id: `${key}-${not_ancmt_mgt_no}`,
              districtName,
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
            if (typeof $$ !== "function") return;

            $$(".file-list .file").each((_, e) => {
              files.push({
                url: `${domain}${$$(e).attr("href")}`,
                name: $$(e).text().trim(),
              });
            });

            crawlDatas.push({
              _id: `${key}-${nttId}`,
              districtName,
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
      eminTableCheerioSelector = ".tblWrap > table > tbody > tr";
      break;

    case "SEOCHOGU":
      eminTableCheerioSelector = ".board > .list > tbody > tr";
      break;
  }

  if (eminTableCheerioSelector) {
    await Promise.all(
      $(eminTableCheerioSelector).map(async (_, el) => {
        let [
          not_ancmt_mgt_no,
          title,
          department,
          startDate,
          endDate,
          files,
          eminTrFilesSelector,
        ] = ["", "", "", "", "", [], ""];

        switch (key) {
          case "BUNDANGGU":
            not_ancmt_mgt_no = $(el)
              .find(".title > a")
              .attr("onclick")
              ?.split("'")?.[1];
            department = $(el).find("td:nth-of-type(4)").text().trim();
            startDate = $(el).find("td:nth-of-type(5)").text().trim();
            endDate = $(el)
              .find("td:nth-of-type(6)")
              .text()
              ?.split("~")?.[1]
              ?.trim();
            eminTrFilesSelector = "tr:nth-of-type(4) > .bd01td > a";
            break;

          case "SEOCHOGU":
            not_ancmt_mgt_no = $(el)
              .find("td.left > a")
              .attr("onclick")
              ?.split("'")?.[1];
            title = $(el).find("td:nth-of-type(3) > a").text().trim();
            department = $(el).find("td:nth-of-type(4)").text().trim();
            startDate = $(el).find("td:nth-of-type(5)").text().trim();
            endDate = $(el)
              .find("td:nth-of-type(6)")
              .text()
              ?.split("~")?.[1]
              ?.trim();
            eminTrFilesSelector = "tr:last-child > td > p > a";
            break;
        }

        if (!not_ancmt_mgt_no) return;
        const link = `${domain}${EMINWON.URL.VIEW}${not_ancmt_mgt_no}${eminCggQueryParamUrl}`;

        try {
          const $$ = await crawlCheerio(link);
          if (typeof $$ !== "function") return;

          if (eminTrFilesSelector) {
            $$(eminTrFilesSelector).each((_, e) => {
              const f = $$(e).attr("href")?.split("'");
              if (f?.length > 0) {
                files.push({
                  url: `${domain}${EMINWON.URL.FILE}?user_file_nm=${f[1]}&sys_file_nm=${f[3]}&file_path=${f[5]}`,
                  name: f[1],
                });
              }
            });
          }

          if (key === "BUNDANGGU") {
            title = $$(".listx").text();
          }

          crawlDatas.push({
            _id: `${key}-${not_ancmt_mgt_no}`,
            districtName,
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
  }

  return { crawlDatas, errors };
};

app.listen(PORT, () => {
  console.log(`CRAWL SERVER START! [PORT:${PORT}]`);
});
