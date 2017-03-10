litsource = slang.js slang_parse.js slang_vocab.js slang_objects.js slang_concurrency.js
libsource = slang_later.js
md_files = $(patsubst %.js,%.js.md,$(litsource))
docco_files = $(patsubst %.js,docs/%.html,$(litsource))
timestamp = "21 Feb 2017 - 3 Mar 2017"

all : slang_all.js slang.js.pdf $(md_files) $(docco_files) revealjs/slang-walkthrough.html revealjs/scopes.html

%.js.md : %.js
	@echo Making $@
	@jdi $<
	@# Skip the last three lines where jdi inserts a "Generated at" footer.
	@# This screws up the files when concatenating the markdowns to make the
	@# final super-pdf.
	@cat $@ | ghead -n -3 > $@.tmp
	@mv $@.tmp $@

slang_all.js: $(litsource) $(libsource)
	cat $(litsource) $(libsource) > slang_all.js

slang.js.pdf: $(md_files)
	pandoc --toc -N \
		   -M author="Srikumar K. S." \
		   -M title="The No Spoon Series : Building Slang" \
		   -M date=$(timestamp) \
		   -t latex -f markdown $(md_files) --latex-engine=xelatex -o slang.js.pdf

docs/slang.html: $(litsource)
	docco $(litsource)

slang-walkthrough.js.md: slang-walkthrough.js
	jdi slang-walkthrough.js

revealjs/slang-walkthrough.html: slang-walkthrough.js.md
	pandoc --toc -M author="Srikumar K. S." \
			     -M title="The No Spoon Series : Building Slang" \
				 -M date="21 Feb 2017" \
				 -t revealjs -s -f markdown slang-walkthrough.js.md -o revealjs/slang-walkthrough.html --slide-level=2 --template=revealjs/index.html

revealjs/scopes.html: scopes.md
	pandoc --toc --standalone \
				 -M author="Srikumar K. S." \
			     -M title="The No Spoon Series : Scopes for modeling hierarchical relationships" \
				 -M date="28 Feb 2017" \
				 -t revealjs -s -f markdown scopes.md -o revealjs/scopes.html --slide-level=2 --template=revealjs/index.html


build:
	git add slang.js.pdf $(md_files) scopes.md $(docco_files) revealjs/slang-walkthrough.html revealjs/scopes.html
	git commit -m build
