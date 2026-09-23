-- Re-evaluate stored leaders after the legitimate-company floor moved from
-- ten employees to two. Keep every other qualification boundary strict.

UPDATE opportunity_leaders
SET status = 'approved',
    qualification_reason = 'qualified',
    updated_at = now()
WHERE status = 'rejected'
  AND followers BETWEEN 2000 AND 50000
  AND employee_count BETWEEN 2 AND 300
  AND (
    lower(country) IN ('us', 'usa', 'united states', 'united states of america')
    OR location ~* '(United States|U\.S\.|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)'
  )
  AND headline ~* '(co-?founder|founder|business owner|CEO|chief executive|CTO|chief technology|CIO|chief information|COO|chief operating|VP( of)? engineering|vice president( of)? engineering|head of (engineering|product|operations|technology|systems)|director of (engineering|technology|systems)|engineering director)'
  AND headline !~* '(career coach|life coach|business coach|mindset coach|personal brand|linkedin growth|linkedin influencer|ghostwriter|open to work|aspiring|student at|intern at|recruiter|talent acquisition|digital creator)';
