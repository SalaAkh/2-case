"""Build editable PPTX, matching PDF slides, and the two-speaker script PDF."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.graphics.barcode.qr import QrCodeWidget

ROOT = Path(__file__).resolve().parent
FONT = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('Deck', str(FONT/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DeckBold', str(FONT/'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('Deck', normal='Deck', bold='DeckBold', italic='Deck', boldItalic='DeckBold')
BG, PANEL, LIME, WHITE, MUTED, BORDER = '101112','1C1E21','D3F950','F4F5F0','B4B8C1','363940'
W,H=13.333333,7.5
pres=Presentation();pres.slide_width=Inches(W);pres.slide_height=Inches(H)
pres.core_properties.title='Zero-Spoiler — исследуй, объясни, примени'
pres.core_properties.subject='Проект для Tomorrow School. Питч на двоих, 5 минут.'
pres.core_properties.author='Команда Zero-Spoiler'
pdf=canvas.Canvas(str(ROOT/'zero-spoiler.pdf'),pagesize=(W*72,H*72))
pdf.setTitle(pres.core_properties.title)
pdf.setAuthor('Команда Zero-Spoiler')
notes=(ROOT/'pitch.md').read_text()
blocks=re.split(r'(?=^## Слайд \d)',notes,flags=re.M)[1:]
slide=None

def rect(x,y,w,h,color,stroke=None,radius=False):
    shape=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h))
    shape.fill.solid();shape.fill.fore_color.rgb=RGBColor.from_string(color)
    if stroke:shape.line.color.rgb=RGBColor.from_string(stroke);shape.line.width=Pt(.7)
    else:shape.line.fill.background()
    if radius:shape.adjustments[0]=.05
    pdf.setFillColor(HexColor('#'+color));pdf.setStrokeColor(HexColor('#'+(stroke or color)))
    if radius:pdf.roundRect(x*72,(H-y-h)*72,w*72,h*72,7,fill=1,stroke=int(bool(stroke)))
    else:pdf.rect(x*72,(H-y-h)*72,w*72,h*72,fill=1,stroke=int(bool(stroke)))

def text(x,y,w,h,value,size=18,color=WHITE,bold=False):
    font='DeckBold' if bold else 'Deck'
    lines=[]
    for paragraph in value.split('\n'):
        lines.extend(simpleSplit(paragraph,font,size,w*72) or [''])
    leading=size*1.22
    if len(lines)*leading>h*72+2:raise ValueError(f'Text overflows: {value[:70]} ({len(lines)} lines)')
    box=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));tf=box.text_frame
    tf.clear();tf.margin_top=tf.margin_bottom=tf.margin_left=tf.margin_right=0;tf.word_wrap=False
    for i,line in enumerate(lines):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph();p.text=line;p.font.name='DejaVu Sans';p.font.size=Pt(size);p.font.bold=bold;p.font.color.rgb=RGBColor.from_string(color);p.line_spacing=Pt(leading);p.space_after=Pt(0);p.space_before=Pt(0)
    pdf.setFillColor(HexColor('#'+color));pdf.setFont(font,size)
    for i,line in enumerate(lines):pdf.drawString(x*72,H*72-y*72-size-i*leading,line)
    return box

def pic(filename,x,y,maxw,maxh):
    path=ROOT/'assets'/filename
    iw,ih=ImageReader(str(path)).getSize();scale=min(maxw/iw,maxh/ih);w,h=iw*scale,ih*scale
    slide.shapes.add_picture(str(path),Inches(x),Inches(y),width=Inches(w),height=Inches(h))
    pdf.drawImage(str(path),x*72,(H-y-h)*72,width=w*72,height=h*72)

def page(number,tag):
    global slide
    if number>1:pdf.showPage()
    slide=pres.slides.add_slide(pres.slide_layouts[6]);rect(0,0,W,H,BG)
    text(.55,.32,5,.25,'ZERO-SPOILER / TOMORROW SCHOOL CASE',9,MUTED)
    text(10.7,.32,2.1,.25,tag,9,LIME)
    rect(.55,7.02,12.2,.01,BORDER)
    text(.55,7.15,10,.2,'2-case.vercel.app  ·  Исследуй. Объясни. Примени.',9,MUTED)
    text(12.15,7.12,.6,.25,f'{number:02d} / 08',9,MUTED)
    note=blocks[number-1].split('\n## Подготовка')[0] if number<=len(blocks) else ''
    slide.notes_slide.notes_text_frame.text=note

def title(kicker,heading,sub=None):
    text(.65,.95,12,.3,kicker,11,LIME)
    text(.65,1.42,12,1.3,heading,35,WHITE,True)
    if sub:text(.65,2.65,11.8,.65,sub,17,MUTED)

page(1,'ПИТЧ / 5 МИНУТ')
text(.65,1.15,10,.5,'ZERO-SPOILER',16,LIME,True)
text(.65,2.0,11,1.7,'От ошибки в коде —\nк самостоятельному решению.',40,WHITE,True)
text(.65,4.15,8.5,1,'Студент исследует, объясняет и проверяет понимание на новой задаче.',23,MUTED)
rect(.65,5.65,7.5,.65,LIME,radius=True)
text(.87,5.82,7.1,.35,'ИССЛЕДУЙ   →   ОБЪЯСНИ   →   ПРИМЕНИ',18,BG,True)

page(2,'ПРОБЛЕМА')
title('01 / ЧТО МЫ ХОТИМ ИЗМЕНИТЬ','Работающий код ещё не показывает,\nчто студент понял причину ошибки.')
for i,(head,body) in enumerate([
 ('Ошибка','Студент затрудняется объяснить поведение программы.'),
 ('Исправление','Результат работает. Причину ещё предстоит проверить.'),
 ('Новая ситуация','Сможет ли студент применить то же правило самостоятельно?')]):
 x=.65+i*4.07;rect(x,3.32,3.85,2.45,PANEL,BORDER,True);text(x+.22,3.53,.5,.35,f'0{i+1}',13,LIME);text(x+.22,4.03,3.4,.5,head,22,WHITE,True);text(x+.22,4.65,3.38,.95,body,17,MUTED)
text(.65,6.15,12,.5,'Нужно видеть путь рассуждения — от предположения до переноса.',20,LIME)

page(3,'УЧЕБНЫЙ ПУТЬ')
title('02 / КАК УСТРОЕН ПРОДУКТ','Понимание становится наблюдаемым.','Первый прогноз сохраняется до показа результата. Повторные попытки его не стирают.')
steps=[('Гипотеза','Что я думаю?'),('Прогноз','Что произойдёт?'),('Наблюдение','Что произошло?'),('Объяснение','Как научить другого?'),('Перенос','Сработает ли правило?')]
for i,(head,body) in enumerate(steps):
 x=.65+i*2.45;rect(x,3.65,2.23,1.95,PANEL,BORDER,True);text(x+.16,3.88,1,.4,f'0{i+1}',18,LIME,True);text(x+.16,4.5,1.96,.45,head,17,WHITE,True);text(x+.16,5.03,1.95,.5,body,12,MUTED)
text(.65,6.0,11.7,.65,'В конце — паспорт: собственные выводы, первые ответы и попытки.',21,WHITE)

page(4,'ДЕМО / СМЕНА РОЛЕЙ')
title('03 / ГЛАВНАЯ ОСОБЕННОСТЬ','Теперь студент — наставник.')
pic('novice.png',.65,2.8,7.25,2.9)
text(.65,6.1,7.3,.5,'Настоящий интерфейс · демонстрационный проход',11,MUTED)
rect(8.4,2.8,4.25,3.6,PANEL,BORDER,True)
text(8.68,3.06,3.7,.5,'Объясни → проверь',23,LIME,True)
text(8.68,3.85,3.55,1.5,'Студент объясняет ошибку новичку и отвечает на уточнение с другими значениями.',20,WHITE)
text(8.68,5.55,3.55,.65,'Подготовленная учебная роль с намеренной ошибкой.',13,MUTED)

page(5,'РЕЗУЛЬТАТ')
title('04 / ПАСПОРТ ПОНИМАНИЯ','Виден путь от догадки к правилу.','Иллюстрация прохождения. Это учебный самоотчёт, а не результаты пилота.')
for x,head,body in [(.65,'Я предполагал','Возможно, проблема в выводе последнего элемента.'),(4.72,'Я проверил','При i = 5 программа обращается к шестой позиции.'),(8.79,'Я применил','В новом списке вычислил индекс и определил результат.')]:
 rect(x,3.55,3.85,2.35,PANEL,BORDER,True);text(x+.23,3.8,3.4,.5,head,21,LIME,True);text(x+.23,4.55,3.35,1.15,body,18,WHITE)
text(.65,6.2,12,.45,'Сохранение PDF / JSON  ·  Обсуждение с преподавателем',18,MUTED)

page(6,'РАБОТАЮЩИЙ MVP')
title('05 / ЧТО УЖЕ МОЖНО ПРОВЕРИТЬ','Продукт готов к демонстрации.')
rect(.65,2.9,6,3.65,PANEL,BORDER,True);text(.92,3.17,5.4,.4,'Учебный режим',23,LIME,True)
text(.92,3.92,5.3,2.25,'Три подготовленных сценария\nСмена ролей и новая задача\nПаспорт и сохранение прогресса\nИнтерфейс для телефона\nРабота без API-ключа',19,WHITE)
rect(6.9,2.9,5.75,3.65,PANEL,BORDER,True);text(7.17,3.17,5.1,.4,'Свободный разбор',23,WHITE,True)
text(7.17,3.92,5.1,1.65,'Редактор и диалог\nСерверная интеграция OpenAI\nФильтр и отдельная проверка ответа\nДля live-режима нужен ключ',18,MUTED)
text(7.17,5.85,5.1,.42,'74 автоматических теста проходят',16,LIME,True)

page(7,'СЛЕДУЮЩИЙ ШАГ')
title('06 / ДОБРОВОЛЬНЫЙ ПИЛОТ','Проверим на реальных студентах.','Протокол и выгрузка готовы. Данные участников ещё не собраны.')
rect(.65,3.55,3.0,2.55,LIME,radius=True);text(.9,3.82,2.5,.85,'5–10',43,BG,True);text(.9,4.93,2.5,.95,'добровольцев\nодин первый проход',16,BG)
text(4.15,3.55,8.2,.5,'Что будем наблюдать',23,WHITE,True)
text(4.15,4.3,8.1,1.6,'Первые ответы до практики и на новой задаче\nПовторные попытки и совпадения прогнозов\nОбъяснения участников — с отдельного согласия',19,MUTED)
text(4.15,6.05,8.1,.55,'Малый пилот без контрольной группы не доказывает причинный эффект.',12,MUTED)

page(8,'ПОПРОБУЙТЕ САМИ')
text(.65,1.1,9,.4,'ZERO-SPOILER',16,LIME,True)
text(.65,2.0,8.7,1.65,'Исследовать.\nОбъяснить. Применить.',38,WHITE,True)
text(.65,4.0,8,1.1,'Предлагаем провести добровольный пилот в учебной практике Tomorrow School.',23,MUTED)
url='https://2-case.vercel.app/investigation?mode=jury'
box=text(.65,5.65,8.2,.6,'2-case.vercel.app',25,LIME,True)
for p in box.text_frame.paragraphs:
 for r in p.runs:r.hyperlink.address=url
pdf.linkURL(url,(.65*72,(H-6.25)*72,8.85*72,(H-5.65)*72),relative=0)
q=QrCodeWidget(url);q.qr.make();n=q.qr.getModuleCount();x,y,size=10,2.6,2.55;unit=size/(n+8)
rect(x,y,size,size,'FFFFFF',radius=False)
for r,row in enumerate(q.qr.modules):
 for col,v in enumerate(row):
  if v:rect(x+(col+4)*unit,y+(r+4)*unit,unit+.001,unit+.001,'101112')
text(9.8,5.45,3.0,.8,'QR → демо для жюри\nСканируйте с телефона',14,MUTED)
pdf.save();pres.save(str(ROOT/'zero-spoiler.pptx'))

# Readable A4 rehearsal script; preserve speaker cues, timings and Q&A.
styles={
 'title':ParagraphStyle('title',fontName='DeckBold',fontSize=22,leading=28,textColor=HexColor('#172012'),spaceAfter=18),
 'heading':ParagraphStyle('heading',fontName='DeckBold',fontSize=13,leading=18,spaceBefore=16,spaceAfter=8,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Deck',fontSize=10.5,leading=16,spaceAfter=8),
}
flow=[]
for para in notes.split('\n\n'):
 para=para.strip()
 if not para:continue
 kind='title' if para.startswith('# ') else 'heading' if para.startswith('## ') else 'body'
 para=re.sub(r'^#{1,2} ','',para)
 para=escape(para).replace('\n','<br/>')
 para=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',para)
 flow.append(Paragraph(para,styles[kind]))

def footer(c,doc):
 c.setFont('Deck',8);c.setFillColor(HexColor('#666666'));c.drawString(42,25,'Zero-Spoiler · сценарий на двоих');c.drawRightString(A4[0]-42,25,str(doc.page))
SimpleDocTemplate(str(ROOT/'pitch.pdf'),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=38,bottomMargin=42,title='Zero-Spoiler — питч на двоих',author='Команда Zero-Spoiler').build(flow,onFirstPage=footer,onLaterPages=footer)
print('Created zero-spoiler.pptx, zero-spoiler.pdf and pitch.pdf')
