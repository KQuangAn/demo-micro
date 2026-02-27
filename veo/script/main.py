import requests
import bs4 as bs
import pandas as pd  # Importing pandas for data handling

username = 'hqtuan1@cmcglobal.vn'
password = 'CMCG2025@'

login_url = 'https://amchamvietnam.chambermaster.com/login'
# Base URL for the directory
base_url = "https://amchamvietnam.chambermaster.com/mic/members/search?q=&ql=&gi=51&gi=35&gi=38&gi=37&d=0&st=&memid=4967&repid=18889&micversion=4"

def get_pagination_links(soup):
    """Extract pagination links from the pagination section."""
    pagination = soup.find('ol', class_='pagination')
    links = []
    
    for li in pagination.find_all('li'):
        a_tag = li.find('a')
        if a_tag and 'href' in a_tag.attrs:
            href = a_tag['href']
            if not href.startswith('http'):
                links.append(f"https://www.ccifv.org{href}")
    
    return links

def scrape(url):
    response = requests.get(url, verify=False)

    if response.status_code != 200:
        print(f"Failed to retrieve {url}")
        return []

    soup = bs.BeautifulSoup(response.content, 'html.parser')
    companies = []

    # Find all company boxes
    entries = soup.find_all('div', class_='span12 mn-searchlisting-detail')
    for entry in entries:
        name = entry.find('div', class_='span8').text.strip() if entry.find('h2', class_='title') else 'N/A'
        domain = entry.find_all('p')[0].text.strip() if entry.find_all('p') else 'N/A'  # First p tag for domain
        location = entry.find_all('p')[1].text.strip() if len(entry.find_all('p')) > 1 else 'N/A'  # Second p tag for location
        website = entry.find('a')['href'] if entry.find('a') else 'N/A'  # Link in the first p tag

        companies.append({
            'Name': name,
            'title': 'N/A',
            'Company Name': 'N/A',  
            'Contact Info (nếu có)': 'N/A', 
            'Domain': domain,
            'location': location,
            'Sizing': website
        })

    return companies

def main():
    payload = {
    'username': username,
    'password': password
    }

    session = requests.Session()

    # Log in to the website
    response = session.post(login_url, data=payload)

    if response.ok:
        print("Logged in successfully!")

        # Now navigate to the protected page
        response = session.get(data_url)

        # Check if the page was accessed successfully
        if response.ok:
            # Parse the page content with BeautifulSoup
            soup = BeautifulSoup(response.content, 'html.parser')

            # Extract the desired data
            # Example: find all paragraph tags
            paragraphs = soup.find_all('p')
            for paragraph in paragraphs:
                print(paragraph.text)
        else:
            print("Failed to access the data page.")
    else:
        print("Login failed.")

    all_companies = []
    
    # Start by scraping the first page
    print("Scraping the first page...")
    first_page_url = base_url
    first_page_companies = scrape(first_page_url)
    all_companies.extend(first_page_companies)

    # Get pagination links from the first page
    response = requests.get(first_page_url, verify=False)
    soup = bs.BeautifulSoup(response.content, 'html.parser')
    pagination_links = get_pagination_links(soup)
    print(f"Found {len(pagination_links)} pagination links.", pagination_links)
    # Scrape the next two pages based on the pagination links
    for url in pagination_links[:2]:  # Get the first two pagination links
        print(f"Scraping {url}...")
        companies = scrape(url)
        all_companies.extend(companies)

    # Create a DataFrame and write to an Excel file
    df = pd.DataFrame(all_companies)
    df.to_excel("companies_directory.xlsx", index=False)

    print("Data has been written to companies_directory.xlsx")

if __name__ == "__main__":
    main()