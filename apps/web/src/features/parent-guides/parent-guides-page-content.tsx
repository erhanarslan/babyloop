"use client";

import { useMemo, useState } from "react";
import { PageContainer } from "../../components/ui";
import { ProtectedActionLink as Link } from "../auth/protected-action-link";

type ParentQuestion = {
  id: string;
  title: string;
  answer: string;
  tips: string[];
};

type AgeGuide = {
  id: string;
  label: string;
  questions: ParentQuestion[];
};

const ageGuides: AgeGuide[] = [
  {
    id: "0-3",
    label: "0-3 ay",
    questions: [
      {
        id: "gaz-sancisi",
        title: "Gaz sancısına ne iyi gelir?",
        answer: "Bazen küçük rahatlatma adımları bebeğin gevşemesine yardımcı olabilir.",
        tips: [
          "Bebeği dik tutup kısa süre sakin şekilde gezdir.",
          "Karnına çok bastırmadan nazik hareketler dene.",
          "Beslenme sonrası gaz çıkarmaya zaman ayır.",
          "Şikâyet şiddetliyse, uzun sürüyorsa veya bebeğin genel hali iyi değilse doktoruna danış."
        ]
      },
      {
        id: "uykuya-gecis",
        title: "Uykuya geçişi nasıl kolaylaştırırım?",
        answer: "Kısa ve tekrar eden bir rutin bebeğe sıradaki adımı hissettirebilir.",
        tips: [
          "Işığı azalt, ortamı sakinleştir.",
          "Her uyku öncesi benzer sıra kullan.",
          "Açlık, bez ve ortam ısısını hızlıca kontrol et."
        ]
      },
      {
        id: "destek-zamani",
        title: "Ne zaman daha fazla destek almalıyım?",
        answer: "İçine sinmeyen bir durum varsa beklemek zorunda değilsin.",
        tips: [
          "Ateş, zor nefes alma veya sürekli halsizlik varsa yardım al.",
          "Beslenme belirgin azaldıysa doktoruna danış.",
          "Ebeveyn olarak çok yorulduysan yakınından destek iste."
        ]
      }
    ]
  },
  {
    id: "3-6",
    label: "3-6 ay",
    questions: [
      {
        id: "gunduz-uykusu",
        title: "Gündüz uykuları neden kısalır?",
        answer: "Bu dönemde uyanıklık süresi değişebilir; kısa uykular her zaman sorun anlamına gelmez.",
        tips: [
          "Uykudan önce fazla uyaranı azalt.",
          "Aynı sakinleşme adımlarını tekrar et.",
          "Çok yorgun kalmadan uykuya geçişi dene."
        ]
      },
      {
        id: "oyuncak-secimi",
        title: "Oyuncak seçerken neye dikkat ederim?",
        answer: "Basit, kolay kavranan ve güvenli oyuncaklar çoğu zaman yeterlidir.",
        tips: [
          "Küçük kopabilir parça olmamasına bak.",
          "Kolay temizlenebilir yüzey seç.",
          "Çok sesli ve yoğun oyuncakları sınırlı kullan."
        ]
      },
      {
        id: "dis-cikarma",
        title: "Diş çıkarma huzursuzluğu nasıl anlaşılır?",
        answer: "Salya artışı, elini ağza götürme ve huzursuzluk bu dönemde görülebilir.",
        tips: [
          "Temiz ve güvenli diş kaşıyıcı kullanabilirsin.",
          "Ağız çevresini nazikçe kuru tut.",
          "Ateş veya belirgin kötüleşme varsa doktoruna danış."
        ]
      }
    ]
  },
  {
    id: "6-12",
    label: "6-12 ay",
    questions: [
      {
        id: "ek-gida-duzeni",
        title: "Ek gıda döneminde düzen nasıl kurulur?",
        answer: "Amaç hemen kusursuz düzen değil; bebeğin yeni tatlara sakin şekilde alışmasıdır.",
        tips: [
          "Küçük porsiyonlarla başla.",
          "Yeni tatları acele etmeden dene.",
          "Ana beslenme düzeni için doktorunun önerisini takip et."
        ]
      },
      {
        id: "emekleme-guvenlik",
        title: "Emekleme döneminde evde nelere dikkat ederim?",
        answer: "Bebek hareketlendikçe evin alt seviyesini onun göz hizasıyla düşünmek işe yarar.",
        tips: [
          "Kablo, küçük parça ve keskin köşeleri kontrol et.",
          "Dolap ve prizleri güvenli hale getir.",
          "Zemin temizliği ve kayma riskine dikkat et."
        ]
      },
      {
        id: "gece-uyanma",
        title: "Gece uyanmaları neden artabilir?",
        answer: "Yeni beceriler, diş dönemi veya gündüz düzenindeki değişiklikler geceyi etkileyebilir.",
        tips: [
          "Gece müdahalelerini sakin ve kısa tut.",
          "Gündüz uyku ve beslenme ritmini gözlemle.",
          "Ani ve belirgin değişimde doktoruna danış."
        ]
      }
    ]
  },
  {
    id: "12-24",
    label: "12-24 ay",
    questions: [
      {
        id: "ofke-ani",
        title: "Öfke anında nasıl sakin kalırım?",
        answer: "Önce kendi sesini ve bedenini sakinleştirmek çocuğa da alan açar.",
        tips: [
          "Kısa ve net cümleler kur.",
          "Duygusunu adlandır: “Kızdın, anlıyorum.”",
          "Güvenliyse birkaç dakika yanında kalıp bekle."
        ]
      },
      {
        id: "yemek-secme",
        title: "Yemek seçme döneminde ne yapabilirim?",
        answer: "Bu dönemde seçicilik artabilir; baskı yerine tekrar ve sakinlik daha işe yarar.",
        tips: [
          "Tabağı küçük ve sade tut.",
          "Yeni yiyeceği birkaç kez farklı günlerde sun.",
          "Büyüme veya beslenme kaygın varsa doktoruna danış."
        ]
      },
      {
        id: "disari-hazirlik",
        title: "Dışarı çıkarken hazırlığı nasıl kolaylaştırırım?",
        answer: "Önceden küçük bir düzen kurmak çıkış anındaki stresi azaltır.",
        tips: [
          "Çanta içinde sabit temel liste tut.",
          "Kıyafet ve ayakkabıyı önceden hazırla.",
          "Çocuğa kısa seçenek sun: “Bunu mu bunu mu?”"
        ]
      }
    ]
  },
  {
    id: "24-36",
    label: "24-36 ay",
    questions: [
      {
        id: "tuvalet-aliskanligi",
        title: "Tuvalet alışkanlığına ne zaman başlanır?",
        answer: "Hazır oluş işaretleri zamandan daha önemlidir.",
        tips: [
          "Kısa süre kuru kalma ve merak etme işaretlerine bak.",
          "Baskı kurmadan tanıştır.",
          "Zorlanıyorsa ara verip sonra tekrar dene."
        ]
      },
      {
        id: "oyuncak-paylasma",
        title: "Oyuncak paylaşmak istemezse ne yaparım?",
        answer: "Paylaşmak öğrenilen bir beceridir; hemen olmasını beklemek zorlayabilir.",
        tips: [
          "Sırayla oynama dilini kullan.",
          "Çok sevdiği oyuncağı paylaşmaya zorlamadan ayır.",
          "Kısa süreli ve net örnekler göster."
        ]
      },
      {
        id: "uyku-rutini",
        title: "Uyku rutinini nasıl korurum?",
        answer: "Basit ve tahmin edilebilir bir sıra çoğu çocuk için rahatlatıcıdır.",
        tips: [
          "Ritüeli kısa tut: banyo, kitap, iyi geceler gibi.",
          "Ekran ve hareketli oyunu uyku öncesi azalt.",
          "Rutin bozulursa ertesi gün aynı sıraya dön."
        ]
      }
    ]
  }
];

const fallbackAgeGuide = ageGuides[0]!;
const fallbackQuestion = fallbackAgeGuide.questions[0]!;

export function ParentGuidesPageContent() {
  const [activeAgeId, setActiveAgeId] = useState(fallbackAgeGuide.id);
  const [activeQuestionId, setActiveQuestionId] = useState(fallbackQuestion.id);

  const activeAge = useMemo(
    () => ageGuides.find((guide) => guide.id === activeAgeId) ?? fallbackAgeGuide,
    [activeAgeId]
  );

  const activeQuestion = useMemo(
    () => activeAge.questions.find((question) => question.id === activeQuestionId) ?? activeAge.questions[0] ?? fallbackQuestion,
    [activeAge, activeQuestionId]
  );

  function selectAge(guide: AgeGuide) {
    setActiveAgeId(guide.id);
    setActiveQuestionId(guide.questions[0]?.id ?? fallbackQuestion.id);
  }

  const assistantHref = `/assistant?mode=age_needs&prompt=${encodeURIComponent(
    `${activeAge.label} döneminde "${activeQuestion.title}" sorusu için kısa ve sakin bir ebeveyn yanıtı hazırla.`
  )}`;

  return (
    <PageContainer className="pb-16 pt-6 sm:pt-8" ariaLabel="Ebeveyn rehberi">
      <section className="mb-4 sm:mb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Ebeveyn rehberi
        </h1>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(55,48,42,0.09)]">
        <div className="grid lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-border/70 bg-muted/25 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <div className="flex gap-2 overflow-x-auto pb-3 lg:grid lg:overflow-visible lg:pb-0">
              {ageGuides.map((guide) => {
                const isActiveAge = guide.id === activeAge.id;

                return (
                  <div
                    className={[
                      "min-w-[190px] rounded-2xl border p-2.5 lg:min-w-0",
                      isActiveAge ? "border-primary/40 bg-background" : "border-transparent bg-transparent"
                    ].join(" ")}
                    key={guide.id}
                  >
                    <button
                      aria-pressed={isActiveAge}
                      className={[
                        "w-full rounded-xl px-3 py-2 text-left text-sm font-black transition",
                        isActiveAge
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/75 text-foreground hover:bg-background"
                      ].join(" ")}
                      type="button"
                      onClick={() => selectAge(guide)}
                    >
                      {guide.label}
                    </button>

                    <div className="mt-2 grid gap-1 border-l border-border/80 pl-2">
                      {guide.questions.map((question) => {
                        const isActiveQuestion = isActiveAge && question.id === activeQuestion.id;

                        return (
                          <button
                            aria-pressed={isActiveQuestion}
                            className={[
                              "rounded-lg px-2 py-1.5 text-left text-[0.82rem] font-bold leading-snug transition",
                              isActiveQuestion
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                            ].join(" ")}
                            key={question.id}
                            type="button"
                            onClick={() => {
                              setActiveAgeId(guide.id);
                              setActiveQuestionId(question.id);
                            }}
                          >
                            {question.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <article className="grid content-start gap-4 p-5 sm:p-7 lg:p-9">
            <p className="text-sm font-black text-primary">{activeAge.label}</p>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {activeQuestion.title}
              </h2>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-muted-foreground">
                {activeQuestion.answer}
              </p>
            </div>

            <ul className="grid max-w-2xl gap-3">
              {activeQuestion.tips.slice(0, 4).map((tip) => (
                <li className="flex gap-3 text-sm font-semibold leading-6 text-foreground" key={tip}>
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <Link
                authTitle="Asistana sormak için giriş yap"
                className="inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2.5 text-sm font-black text-foreground transition hover:bg-muted"
                href={assistantHref}
              >
                Asistana sor
              </Link>
            </div>
          </article>
        </div>
      </section>
    </PageContainer>
  );
}
